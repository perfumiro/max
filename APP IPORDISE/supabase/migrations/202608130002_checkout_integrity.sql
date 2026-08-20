-- Hostile-input hardening for checkout and atomic support creation.

alter table public.orders add column if not exists request_hash text;
alter table public.orders drop constraint if exists orders_request_hash_format;
alter table public.orders add constraint orders_request_hash_format
  check (request_hash is null or request_hash ~ '^[0-9a-f]{64}$') not valid;

create or replace function public.create_commerce_order(
  p_user_id uuid,
  p_customer jsonb,
  p_requested_items jsonb,
  p_idempotency_key text,
  p_request_hash text,
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
  v_delivery_text text;
  v_threshold_text text;
  v_order_number text;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'AUTH_REQUIRED'; end if;
  if p_idempotency_key !~ '^[A-Za-z0-9-]{20,100}$' then raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_KEY'; end if;
  if p_request_hash !~ '^[0-9a-f]{64}$' then raise exception using errcode = '22023', message = 'INVALID_REQUEST_HASH'; end if;
  if p_source not in ('website', 'mobile_app', 'admin') then raise exception using errcode = '22023', message = 'INVALID_ORDER_SOURCE'; end if;
  if jsonb_typeof(p_customer) <> 'object'
    or length(trim(coalesce(p_customer->>'name', ''))) not between 2 and 120
    or length(trim(coalesce(p_customer->>'city', ''))) not between 2 and 100
    or length(trim(coalesce(p_customer->>'address', ''))) not between 5 and 300
    or coalesce(p_customer->>'phone', '') !~ '^(?:\+?212|0)[5-7][0-9]{8}$'
    or (p_customer->>'email' is not null and (length(p_customer->>'email') > 254 or p_customer->>'email' !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then
    raise exception using errcode = '22023', message = 'INVALID_CUSTOMER';
  end if;
  if p_notes is not null and length(p_notes) > 1000 then raise exception using errcode = '22023', message = 'INVALID_NOTES'; end if;
  if jsonb_typeof(p_requested_items) <> 'array' or jsonb_array_length(p_requested_items) < 1 or jsonb_array_length(p_requested_items) > 50 then
    raise exception using errcode = '22023', message = 'INVALID_ITEMS';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_requested_items) item
    group by item->>'variantId' having count(*) > 1
  ) then raise exception using errcode = '22023', message = 'DUPLICATE_ITEM'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id is distinct from p_user_id then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_OWNER_MISMATCH';
    end if;
    if v_existing.request_hash is not null and v_existing.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return jsonb_build_object('order', to_jsonb(v_existing), 'replayed', true);
  end if;

  -- A stable lock order prevents two multi-item carts containing the same
  -- variants in opposite order from deadlocking under concurrent checkout.
  for v_request in
    select value from jsonb_array_elements(p_requested_items)
    order by value->>'variantId'
  loop
    if jsonb_typeof(v_request) <> 'object'
      or jsonb_typeof(v_request->'variantId') <> 'string'
      or jsonb_typeof(v_request->'quantity') <> 'number'
      or jsonb_typeof(v_request->'expectedUnitPriceMinor') <> 'number'
      or (v_request->>'quantity') !~ '^[0-9]+$'
      or (v_request->>'expectedUnitPriceMinor') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'INVALID_ITEMS';
    end if;
    v_quantity := (v_request->>'quantity')::integer;
    v_expected_price := (v_request->>'expectedUnitPriceMinor')::bigint;
    if v_quantity < 1 or v_quantity > 20 or v_expected_price < 0 or v_expected_price > 100000000 then
      raise exception using errcode = '22023', message = 'INVALID_ITEMS';
    end if;

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
    if v_expected_price <> v_variant.price_minor then
      raise exception using errcode = 'P0001', message = 'PRICE_CHANGED';
    end if;

    if v_variant.stock_quantity is not null then
      update public.product_variants
      set stock_quantity = stock_quantity - v_quantity
      where id = v_variant.id and stock_quantity >= v_quantity;
      if not found then raise exception using errcode = 'P0001', message = 'OUT_OF_STOCK'; end if;
    end if;

    v_subtotal_minor := v_subtotal_minor + v_variant.price_minor * v_quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_variant.product_id, 'variantId', v_variant.id,
      'productName', v_variant.name, 'name', v_variant.name, 'brand', v_variant.brand,
      'image', v_variant.image, 'size', v_variant.size_label, 'format', v_variant.format,
      'sku', v_variant.sku, 'quantity', v_quantity,
      'unitPriceMinor', v_variant.price_minor, 'unitPrice', v_variant.price_minor / 100.0,
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
    ) then raise exception using errcode = 'P0001', message = 'DELIVERY_UNAVAILABLE'; end if;

  v_delivery_text := coalesce(v_settings->'delivery_fees'->>v_city, v_settings->>'delivery_fee', '35');
  if v_delivery_text !~ '^[0-9]+(?:\.[0-9]{1,2})?$' or v_delivery_text::numeric > 100000 then
    raise exception using errcode = 'P0001', message = 'DELIVERY_CONFIGURATION_INVALID';
  end if;
  v_delivery_minor := round(v_delivery_text::numeric * 100)::bigint;
  v_threshold_text := v_settings->>'free_delivery_threshold';
  if v_threshold_text is not null then
    if v_threshold_text !~ '^[0-9]+(?:\.[0-9]{1,2})?$' or v_threshold_text::numeric > 100000000 then
      raise exception using errcode = 'P0001', message = 'DELIVERY_CONFIGURATION_INVALID';
    end if;
    if v_subtotal_minor >= round(v_threshold_text::numeric * 100)::bigint then v_delivery_minor := 0; end if;
  end if;

  v_order_number := 'IP-' || to_char(clock_timestamp(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.orders (
    user_id, order_number, customer, items, subtotal, delivery_fee, discount, total,
    currency, status, payment_method, notes, idempotency_key, request_hash, source,
    risk_score, risk_level, risk_flags, notification_status
  ) values (
    p_user_id, v_order_number, p_customer, v_items,
    v_subtotal_minor / 100.0, v_delivery_minor / 100.0, v_discount_minor / 100.0,
    (v_subtotal_minor + v_delivery_minor - v_discount_minor) / 100.0,
    'MAD', 'pending', 'cash_on_delivery', nullif(trim(p_notes), ''), p_idempotency_key, p_request_hash, p_source,
    0, 'low', '[]'::jsonb, 'pending'
  ) returning * into v_order;

  insert into public.order_status_history(order_id, from_status, to_status, changed_by)
  values (v_order.id, null, 'pending', 'checkout');
  return jsonb_build_object('order', to_jsonb(v_order), 'replayed', false);
end;
$$;

revoke all on function public.create_commerce_order(uuid, jsonb, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_commerce_order(uuid, jsonb, jsonb, text, text, text, text) to service_role;
revoke all on function public.create_commerce_order(uuid, jsonb, jsonb, text, text, text) from service_role;

create or replace function public.create_support_conversation(
  p_name text,
  p_email text,
  p_subject text,
  p_message text,
  p_order_number text,
  p_client_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if length(p_name) not between 2 and 120
    or length(p_email) not between 3 and 254
    or length(p_subject) not between 2 and 120
    or length(p_message) not between 5 and 4000
    or p_client_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_SUPPORT_REQUEST';
  end if;
  insert into public.support_conversations(customer_name, customer_email, order_number, subject, client_token_hash)
  values (p_name, p_email, nullif(p_order_number, ''), p_subject, p_client_token_hash)
  returning id into v_id;
  insert into public.support_messages(conversation_id, sender_type, body)
  values (v_id, 'customer', p_message);
  return v_id;
end;
$$;

revoke all on function public.create_support_conversation(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_support_conversation(text, text, text, text, text, text) to service_role;
