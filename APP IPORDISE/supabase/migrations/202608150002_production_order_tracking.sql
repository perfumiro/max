-- Production order tracking: canonical identity, safe public projection,
-- complete fulfilment states, and staff-managed courier data.

create or replace function public.normalize_moroccan_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
begin
  if left(v_digits, 2) = '00' then v_digits := substr(v_digits, 3); end if;
  if left(v_digits, 3) = '212' then v_digits := substr(v_digits, 4); end if;
  if left(v_digits, 1) = '0' then v_digits := substr(v_digits, 2); end if;
  if v_digits !~ '^[5-7][0-9]{8}$' then return null; end if;
  return '+212' || v_digits;
end;
$$;
revoke all on function public.normalize_moroccan_phone(text) from public, anon, authenticated;
grant execute on function public.normalize_moroccan_phone(text) to service_role;

create or replace function public.canonicalize_order_customer_phone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_phone text;
begin
  v_phone := public.normalize_moroccan_phone(new.customer->>'phone');
  if v_phone is null then
    raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_PHONE';
  end if;
  new.customer := jsonb_set(new.customer, '{phone}', to_jsonb(v_phone), true);
  return new;
end;
$$;
revoke all on function public.canonicalize_order_customer_phone() from public, anon, authenticated;

update public.orders
set customer = jsonb_set(customer, '{phone}', to_jsonb(public.normalize_moroccan_phone(customer->>'phone')), true)
where public.normalize_moroccan_phone(customer->>'phone') is not null
  and customer->>'phone' is distinct from public.normalize_moroccan_phone(customer->>'phone');

drop trigger if exists orders_canonical_customer_phone on public.orders;
create trigger orders_canonical_customer_phone
before insert or update of customer on public.orders
for each row execute function public.canonicalize_order_customer_phone();

alter table public.orders
  add column if not exists courier_code text,
  add column if not exists courier_name text,
  add column if not exists tracking_number text,
  add column if not exists estimated_delivery timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending', 'confirmed', 'processing', 'ready_for_dispatch', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled', 'return_requested',
  'returned', 'delivery_failed'
)) not valid;
alter table public.orders drop constraint if exists orders_shipping_fields_valid;
alter table public.orders add constraint orders_shipping_fields_valid check (
  (courier_code is null or char_length(courier_code) between 1 and 40) and
  (courier_name is null or char_length(courier_name) between 1 and 100) and
  (tracking_number is null or char_length(tracking_number) between 1 and 100)
) not valid;

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
    (p_expected_status = 'processing' and p_new_status in ('ready_for_dispatch', 'shipped', 'cancelled')) or
    (p_expected_status = 'ready_for_dispatch' and p_new_status in ('shipped', 'cancelled')) or
    (p_expected_status = 'shipped' and p_new_status in ('out_for_delivery', 'delivered', 'delivery_failed')) or
    (p_expected_status = 'out_for_delivery' and p_new_status in ('delivered', 'delivery_failed')) or
    (p_expected_status = 'delivery_failed' and p_new_status in ('out_for_delivery', 'returned')) or
    (p_expected_status = 'delivered' and p_new_status = 'return_requested') or
    (p_expected_status = 'return_requested' and p_new_status = 'returned')
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

  update public.orders set
    status = p_new_status,
    inventory_released = v_order.inventory_released,
    shipped_at = case when p_new_status = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when p_new_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = p_order_id returning * into v_order;

  insert into public.order_status_history(order_id, from_status, to_status, changed_by)
  values (p_order_id, p_expected_status, p_new_status, left(coalesce(p_changed_by, 'admin'), 254));
  return v_order;
end;
$$;
revoke all on function public.transition_commerce_order(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.transition_commerce_order(uuid, text, text, text) to service_role;

create or replace function public.update_order_shipping(
  p_order_id uuid,
  p_courier_code text,
  p_courier_name text,
  p_tracking_number text,
  p_estimated_delivery timestamptz,
  p_changed_by text
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype;
begin
  if length(trim(coalesce(p_courier_code, ''))) > 40
    or length(trim(coalesce(p_courier_name, ''))) > 100
    or length(trim(coalesce(p_tracking_number, ''))) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_SHIPPING_DETAILS';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND'; end if;
  update public.orders set
    courier_code = nullif(trim(p_courier_code), ''),
    courier_name = nullif(trim(p_courier_name), ''),
    tracking_number = nullif(trim(p_tracking_number), ''),
    estimated_delivery = p_estimated_delivery
  where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;
revoke all on function public.update_order_shipping(uuid, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.update_order_shipping(uuid, text, text, text, timestamptz, text) to service_role;

create or replace function public.track_commerce_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
  v_history jsonb;
  v_item_count integer;
begin
  select * into v_order
  from public.orders
  where order_number = upper(trim(p_order_number))
    and public.normalize_moroccan_phone(customer->>'phone') = public.normalize_moroccan_phone(p_phone)
  limit 1;
  if not found or public.normalize_moroccan_phone(p_phone) is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'brand', nullif(item->>'brand', ''),
    'name', coalesce(nullif(item->>'name', ''), nullif(item->>'productName', ''), 'Fragrance'),
    'image', nullif(item->>'image', ''),
    'size', coalesce(nullif(item->>'size', ''), nullif(item->>'format', '')),
    'quantity', greatest(1, coalesce((item->>'quantity')::integer, 1)),
    'lineTotal', case when jsonb_typeof(item->'lineTotal') = 'number' then (item->>'lineTotal')::numeric else null end
  ))), '[]'::jsonb),
  coalesce(sum(greatest(1, coalesce((item->>'quantity')::integer, 1))), 0)::integer
  into v_items, v_item_count
  from jsonb_array_elements(case when jsonb_typeof(v_order.items) = 'array' then v_order.items else '[]'::jsonb end) item;

  select coalesce(jsonb_agg(jsonb_build_object('status', to_status, 'createdAt', created_at) order by created_at, id), '[]'::jsonb)
  into v_history from public.order_status_history where order_id = v_order.id;

  return jsonb_strip_nulls(jsonb_build_object(
    'orderNumber', v_order.order_number,
    'createdAt', v_order.created_at,
    'status', v_order.status,
    'statusLabel', initcap(replace(v_order.status, '_', ' ')),
    'city', nullif(v_order.customer->>'city', ''),
    'total', v_order.total,
    'currency', v_order.currency,
    'paymentMethod', v_order.payment_method,
    'estimatedDelivery', v_order.estimated_delivery,
    'trackingNumber', v_order.tracking_number,
    'courierName', v_order.courier_name,
    'itemCount', v_item_count,
    'items', v_items,
    'statusHistory', v_history
  ));
end;
$$;
revoke all on function public.track_commerce_order(text, text) from public, anon, authenticated;
grant execute on function public.track_commerce_order(text, text) to service_role;
