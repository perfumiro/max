-- Shared customer identity, professional address book fields, immutable order
-- snapshots, and default-address consistency. Additive and safe to rerun.

alter table public.customer_addresses
  add column if not exists recipient_first_name text,
  add column if not exists recipient_last_name text,
  add column if not exists country text not null default 'Morocco',
  add column if not exists building text,
  add column if not exists apartment text,
  add column if not exists delivery_instructions text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.customer_addresses drop constraint if exists customer_addresses_professional_fields_valid;
alter table public.customer_addresses add constraint customer_addresses_professional_fields_valid check (
  char_length(trim(label)) between 1 and 40
  and char_length(trim(recipient_name)) between 2 and 120
  and char_length(trim(phone)) between 8 and 30
  and char_length(trim(country)) between 2 and 80
  and char_length(trim(city)) between 2 and 100
  and char_length(trim(address_line1)) between 5 and 300
  and (delivery_instructions is null or char_length(delivery_instructions) <= 500)
  and (latitude is null or latitude between -90 and 90)
  and (longitude is null or longitude between -180 and 180)
) not valid;

alter table public.profiles add column if not exists default_address_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_default_address_fk') then
    alter table public.profiles add constraint profiles_default_address_fk
      foreign key (default_address_id) references public.customer_addresses(id) on delete set null;
  end if;
end $$;

create or replace function public.customer_address_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.label := trim(new.label);
  new.recipient_name := trim(new.recipient_name);
  new.phone := trim(new.phone);
  new.country := coalesce(nullif(trim(new.country), ''), 'Morocco');
  new.city := trim(new.city);
  new.address_line1 := trim(new.address_line1);
  if tg_op = 'INSERT' and not exists (
    select 1 from public.customer_addresses where user_id = new.user_id
  ) then new.is_default := true;
  end if;
  if new.is_default then
    update public.customer_addresses set is_default = false
      where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_address_default on public.customer_addresses;
create trigger customer_address_default before insert or update on public.customer_addresses
  for each row execute function public.customer_address_before_write();

create or replace function public.customer_address_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid := coalesce(new.user_id, old.user_id);
  replacement_id uuid;
begin
  if tg_op = 'DELETE' and old.is_default then
    select id into replacement_id from public.customer_addresses
      where user_id = owner_id order by created_at asc limit 1;
    if replacement_id is not null then
      update public.customer_addresses set is_default = true where id = replacement_id;
    else
      update public.profiles set default_address_id = null where user_id = owner_id;
    end if;
  elsif new.is_default then
    update public.profiles set default_address_id = new.id where user_id = owner_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists customer_address_profile_default on public.customer_addresses;
create trigger customer_address_profile_default after insert or update of is_default or delete
  on public.customer_addresses for each row execute function public.customer_address_after_write();

create or replace function public.validate_profile_default_address()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.default_address_id is not null and not exists (
    select 1 from public.customer_addresses
      where id = new.default_address_id and user_id = new.user_id
  ) then raise exception 'DEFAULT_ADDRESS_NOT_OWNED';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_validate_default_address on public.profiles;
create trigger profiles_validate_default_address before insert or update of default_address_id
  on public.profiles for each row execute function public.validate_profile_default_address();

alter table public.orders
  add column if not exists customer_snapshot jsonb,
  add column if not exists shipping_address jsonb,
  add column if not exists billing_address jsonb,
  add column if not exists tracking_url text;

alter table public.orders drop constraint if exists orders_tracking_url_valid;
alter table public.orders add constraint orders_tracking_url_valid check (
  tracking_url is null or (char_length(tracking_url) <= 500 and tracking_url ~ '^https://')
) not valid;

create or replace function public.update_order_shipping(
  p_order_id uuid,
  p_courier_code text,
  p_courier_name text,
  p_tracking_number text,
  p_tracking_url text,
  p_estimated_delivery timestamptz,
  p_changed_by text
)
returns public.orders language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
begin
  if length(trim(coalesce(p_courier_code, ''))) > 40
    or length(trim(coalesce(p_courier_name, ''))) > 100
    or length(trim(coalesce(p_tracking_number, ''))) > 100
    or length(trim(coalesce(p_tracking_url, ''))) > 500
    or (nullif(trim(coalesce(p_tracking_url, '')), '') is not null and trim(p_tracking_url) !~ '^https://') then
    raise exception using errcode = '22023', message = 'INVALID_SHIPPING_DETAILS';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND'; end if;
  update public.orders set
    courier_code = nullif(trim(p_courier_code), ''),
    courier_name = nullif(trim(p_courier_name), ''),
    tracking_number = nullif(trim(p_tracking_number), ''),
    tracking_url = nullif(trim(p_tracking_url), ''),
    estimated_delivery = p_estimated_delivery
  where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;
revoke all on function public.update_order_shipping(uuid, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.update_order_shipping(uuid, text, text, text, text, timestamptz, text) to service_role;

create or replace function public.capture_order_customer_snapshots()
returns trigger language plpgsql set search_path = public as $$
declare name_parts text[];
begin
  name_parts := regexp_split_to_array(trim(coalesce(new.customer->>'name', '')), '\\s+');
  new.customer_snapshot := coalesce(new.customer_snapshot, jsonb_build_object(
    'firstName', coalesce(name_parts[1], ''),
    'lastName', case when array_length(name_parts, 1) > 1 then array_to_string(name_parts[2:array_length(name_parts, 1)], ' ') else '' end,
    'name', coalesce(new.customer->>'name', ''),
    'email', coalesce(new.customer->>'email', ''),
    'phone', coalesce(new.customer->>'phone', '')
  ));
  new.shipping_address := coalesce(new.shipping_address, jsonb_build_object(
    'recipientName', coalesce(new.customer->>'name', ''),
    'phone', coalesce(new.customer->>'phone', ''),
    'country', 'Morocco',
    'city', coalesce(new.customer->>'city', ''),
    'addressLine1', coalesce(new.customer->>'address', ''),
    'deliveryInstructions', coalesce(new.notes, '')
  ));
  return new;
end;
$$;

drop trigger if exists orders_capture_customer_snapshots on public.orders;
create trigger orders_capture_customer_snapshots before insert on public.orders
  for each row execute function public.capture_order_customer_snapshots();

update public.orders set
  customer_snapshot = coalesce(customer_snapshot, jsonb_build_object(
    'name', coalesce(customer->>'name', ''),
    'email', coalesce(customer->>'email', ''),
    'phone', coalesce(customer->>'phone', '')
  )),
  shipping_address = coalesce(shipping_address, jsonb_build_object(
    'recipientName', coalesce(customer->>'name', ''),
    'phone', coalesce(customer->>'phone', ''),
    'country', 'Morocco',
    'city', coalesce(customer->>'city', ''),
    'addressLine1', coalesce(customer->>'address', ''),
    'deliveryInstructions', coalesce(notes, '')
  ))
where customer_snapshot is null or shipping_address is null;

notify pgrst, 'reload schema';
