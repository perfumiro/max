-- Canonical, variant-aware commerce model and transactional checkout.
-- Existing JSON size maps remain as a compatibility projection while clients migrate.

alter table public.products
  add column if not exists publication_status text not null default 'active';

alter table public.products drop constraint if exists products_publication_status_valid;
alter table public.products add constraint products_publication_status_valid
  check (publication_status in ('draft', 'active', 'archived')) not valid;

drop policy if exists "Public reads active products" on public.products;
create policy "Public reads published products" on public.products for select
using ((active and publication_status = 'active') or public.is_ipordise_admin());

update public.products
set publication_status = case when active then 'active' else 'archived' end
where publication_status is distinct from case when active then 'active' else 'archived' end;

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete restrict,
  size_label text not null,
  size_key text not null,
  format text not null default 'full_bottle',
  sku text,
  price_minor bigint not null check (price_minor >= 0),
  compare_at_price_minor bigint check (compare_at_price_minor is null or compare_at_price_minor >= price_minor),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size_key),
  unique (sku),
  check (format in ('decant', 'full_bottle', 'other'))
);

insert into public.product_variants (
  id, product_id, size_label, size_key, format, price_minor,
  compare_at_price_minor, stock_quantity, enabled, sort_order
)
select
  p.id || ':' || lower(regexp_replace(size_entry.key, '\s+', '', 'g')),
  p.id,
  regexp_replace(size_entry.key, 'ml$', ' ml', 'i'),
  lower(regexp_replace(size_entry.key, '\s+', '', 'g')),
  case when substring(size_entry.key from '[0-9]+(?:\.[0-9]+)?')::numeric < 50 then 'decant' else 'full_bottle' end,
  round((size_entry.value #>> '{}')::numeric * 100)::bigint,
  case
    when p.original_prices ? size_entry.key
      and (p.original_prices ->> size_entry.key)::numeric > (size_entry.value #>> '{}')::numeric
    then round((p.original_prices ->> size_entry.key)::numeric * 100)::bigint
    else null
  end,
  p.stock_left,
  p.active and p.publication_status = 'active',
  coalesce(substring(size_entry.key from '[0-9]+')::integer, 100)
from public.products p
cross join lateral jsonb_each(p.sizes) size_entry
where jsonb_typeof(size_entry.value) = 'number'
  and size_entry.key ~* '^[0-9]+(?:\.[0-9]+)?\s*(ml|g)$'
  and (size_entry.value #>> '{}')::numeric >= 0
on conflict (id) do update set
  price_minor = excluded.price_minor,
  compare_at_price_minor = excluded.compare_at_price_minor,
  stock_quantity = excluded.stock_quantity,
  enabled = excluded.enabled,
  updated_at = now();

create index if not exists product_variants_product_enabled_idx
  on public.product_variants (product_id, enabled, sort_order);
create index if not exists product_variants_stock_idx
  on public.product_variants (stock_quantity) where enabled and stock_quantity is not null;

drop trigger if exists product_variants_updated_at on public.product_variants;
create trigger product_variants_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();

alter table public.product_variants enable row level security;
drop policy if exists "Public reads purchasable variants" on public.product_variants;
create policy "Public reads purchasable variants" on public.product_variants for select
using (
  enabled and exists (
    select 1 from public.products p
    where p.id = product_id and p.active and p.publication_status = 'active'
  )
  or public.is_ipordise_admin()
);
drop policy if exists "Admin manages product variants" on public.product_variants;
create policy "Admin manages product variants" on public.product_variants for all to authenticated
using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());
grant select on public.product_variants to anon, authenticated;
grant all on public.product_variants to service_role;

alter table public.orders
  add column if not exists source text not null default 'website',
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists inventory_released boolean not null default false;

alter table public.orders drop constraint if exists orders_source_valid;
alter table public.orders add constraint orders_source_valid
  check (source in ('website', 'mobile_app', 'admin')) not valid;
alter table public.orders drop constraint if exists orders_money_valid;
alter table public.orders add constraint orders_money_valid
  check (subtotal >= 0 and delivery_fee >= 0 and discount >= 0 and total >= 0 and total = subtotal + delivery_fee - discount) not valid;

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_idx
  on public.order_status_history (order_id, created_at);
alter table public.order_status_history enable row level security;
revoke all on public.order_status_history from anon, authenticated;
grant all on public.order_status_history to service_role;
drop policy if exists order_status_history_customer_read on public.order_status_history;
create policy order_status_history_customer_read on public.order_status_history for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_ipordise_admin())));
grant select on public.order_status_history to authenticated;

create or replace function public.create_commerce_order(
  p_user_id uuid,
  p_customer jsonb,
  p_requested_items jsonb,
  p_idempotency_key text,
  p_notes text default null,
  p_source text default 'mobile_app'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.orders%rowtype;
  v_order public.orders%rowtype;
  v_request jsonb;
  v_variant record;
  v_quantity integer;
  v_expected_price bigint;
  v_items jsonb := '[]'::jsonb;
  v_subtotal_minor bigint := 0;
  v_delivery_minor bigint := 0;
  v_discount_minor bigint := 0;
  v_settings jsonb := '{}'::jsonb;
  v_city text := lower(trim(coalesce(p_customer->>'city', '')));
  v_order_number text;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'AUTH_REQUIRED'; end if;
  if p_idempotency_key !~ '^[A-Za-z0-9-]{20,100}$' then raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_KEY'; end if;
  if p_source not in ('website', 'mobile_app', 'admin') then raise exception using errcode = '22023', message = 'INVALID_ORDER_SOURCE'; end if;
  if jsonb_typeof(p_requested_items) <> 'array' or jsonb_array_length(p_requested_items) < 1 or jsonb_array_length(p_requested_items) > 50 then
    raise exception using errcode = '22023', message = 'INVALID_ITEMS';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id is distinct from p_user_id then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_OWNER_MISMATCH';
    end if;
    return jsonb_build_object('order', to_jsonb(v_existing), 'replayed', true);
  end if;

  for v_request in select value from jsonb_array_elements(p_requested_items)
  loop
    v_quantity := coalesce((v_request->>'quantity')::integer, 0);
    if v_quantity < 1 or v_quantity > 20 then raise exception using errcode = '22023', message = 'INVALID_QUANTITY'; end if;

    select
      pv.id, pv.product_id, pv.size_label, pv.size_key, pv.format, pv.sku,
      pv.price_minor, pv.compare_at_price_minor, pv.stock_quantity, pv.enabled,
      p.name, p.brand, p.image, p.active, p.publication_status
    into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_request->>'variantId'
    for update of pv;

    if not found or not v_variant.enabled or not v_variant.active or v_variant.publication_status <> 'active' then
      raise exception using errcode = 'P0001', message = 'ITEM_UNAVAILABLE';
    end if;
    if v_variant.stock_quantity is not null and v_variant.stock_quantity < v_quantity then
      raise exception using errcode = 'P0001', message = 'OUT_OF_STOCK';
    end if;

    v_expected_price := nullif(v_request->>'expectedUnitPriceMinor', '')::bigint;
    if v_expected_price is not null and v_expected_price <> v_variant.price_minor then
      raise exception using errcode = 'P0001', message = 'PRICE_CHANGED';
    end if;

    if v_variant.stock_quantity is not null then
      update public.product_variants
      set stock_quantity = stock_quantity - v_quantity
      where id = v_variant.id;
    end if;

    v_subtotal_minor := v_subtotal_minor + v_variant.price_minor * v_quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_variant.product_id,
      'variantId', v_variant.id,
      'productName', v_variant.name,
      'name', v_variant.name,
      'brand', v_variant.brand,
      'image', v_variant.image,
      'size', v_variant.size_label,
      'format', v_variant.format,
      'sku', v_variant.sku,
      'quantity', v_quantity,
      'unitPriceMinor', v_variant.price_minor,
      'unitPrice', v_variant.price_minor / 100.0,
      'lineTotalMinor', v_variant.price_minor * v_quantity,
      'lineTotal', (v_variant.price_minor * v_quantity) / 100.0
    ));
  end loop;

  select value into v_settings from public.store_settings where id = 'main';
  if jsonb_typeof(v_settings->'supported_cities') = 'array'
    and jsonb_array_length(v_settings->'supported_cities') > 0
    and not exists (
      select 1 from jsonb_array_elements_text(v_settings->'supported_cities') city
      where lower(trim(city)) = v_city
    ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_UNAVAILABLE';
  end if;
  v_delivery_minor := round(coalesce(
    (v_settings->'delivery_fees'->>v_city)::numeric,
    (v_settings->>'delivery_fee')::numeric,
    35
  ) * 100)::bigint;
  if coalesce((v_settings->>'free_delivery_threshold')::numeric * 100, -1) >= 0
    and v_subtotal_minor >= (v_settings->>'free_delivery_threshold')::numeric * 100 then
    v_delivery_minor := 0;
  end if;

  v_order_number := 'IP-' || to_char(clock_timestamp(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.orders (
    user_id, order_number, customer, items, subtotal, delivery_fee, discount, total,
    currency, status, payment_method, notes, idempotency_key, source,
    risk_score, risk_level, risk_flags, notification_status
  ) values (
    p_user_id, v_order_number, p_customer, v_items,
    v_subtotal_minor / 100.0, v_delivery_minor / 100.0, v_discount_minor / 100.0,
    (v_subtotal_minor + v_delivery_minor - v_discount_minor) / 100.0,
    'MAD', 'pending', 'cash_on_delivery', nullif(trim(p_notes), ''), p_idempotency_key, p_source,
    0, 'low', '[]'::jsonb, 'pending'
  ) returning * into v_order;

  insert into public.order_status_history(order_id, from_status, to_status, changed_by)
  values (v_order.id, null, 'pending', 'checkout');

  return jsonb_build_object('order', to_jsonb(v_order), 'replayed', false);
end;
$$;

revoke all on function public.create_commerce_order(uuid, jsonb, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.create_commerce_order(uuid, jsonb, jsonb, text, text, text) to service_role;

create or replace function public.transition_commerce_order(
  p_order_id uuid,
  p_expected_status text,
  p_new_status text,
  p_changed_by text
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> p_expected_status then raise exception using errcode = '40001', message = 'ORDER_STATUS_CHANGED'; end if;
  if not (
    (p_expected_status = 'pending' and p_new_status in ('confirmed', 'cancelled')) or
    (p_expected_status = 'confirmed' and p_new_status in ('processing', 'cancelled')) or
    (p_expected_status = 'processing' and p_new_status in ('shipped', 'cancelled')) or
    (p_expected_status = 'shipped' and p_new_status = 'delivered')
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;

  if p_new_status = 'cancelled' and not v_order.inventory_released then
    for v_item in select value from jsonb_array_elements(v_order.items)
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + greatest(0, coalesce((v_item->>'quantity')::integer, 0))
      where id = v_item->>'variantId' and stock_quantity is not null;
    end loop;
    v_order.inventory_released := true;
  end if;

  update public.orders
  set status = p_new_status, inventory_released = v_order.inventory_released
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history(order_id, from_status, to_status, changed_by)
  values (p_order_id, p_expected_status, p_new_status, left(coalesce(p_changed_by, 'admin'), 254));
  return v_order;
end;
$$;

revoke all on function public.transition_commerce_order(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.transition_commerce_order(uuid, text, text, text) to service_role;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_variants') then
    alter publication supabase_realtime add table public.product_variants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
