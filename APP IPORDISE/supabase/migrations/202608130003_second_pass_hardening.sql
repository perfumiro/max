-- Second-pass hardening: close rollout gaps, bound customer data, make support
-- replies atomic, clean rate-limit storage, and expose one paginated customer API.

update public.orders
set request_hash = encode(digest(idempotency_key || ':legacy-order', 'sha256'), 'hex')
where idempotency_key is not null and request_hash is null;

alter table public.orders drop constraint if exists orders_idempotency_hash_pair;
alter table public.orders add constraint orders_idempotency_hash_pair check (
  (idempotency_key is null and request_hash is null)
  or (idempotency_key is not null and request_hash ~ '^[0-9a-f]{64}$')
) not valid;

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
    or (p_order_number is not null and length(p_order_number) not between 2 and 80)
    or p_client_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_SUPPORT_REQUEST';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(p_email), 0));
  if (select count(*) from public.support_conversations
      where lower(customer_email) = lower(p_email)
        and created_at >= now() - interval '10 minutes') >= 3 then
    raise exception using errcode = 'P0001', message = 'SUPPORT_RATE_LIMITED';
  end if;
  insert into public.support_conversations(customer_name, customer_email, order_number, subject, client_token_hash)
  values (p_name, lower(p_email), nullif(p_order_number, ''), p_subject, p_client_token_hash)
  returning id into v_id;
  insert into public.support_messages(conversation_id, sender_type, body)
  values (v_id, 'customer', p_message);
  return v_id;
end;
$$;

create or replace function public.append_support_message(
  p_conversation_id uuid,
  p_sender_type text,
  p_body text,
  p_next_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_sender_type not in ('customer', 'staff')
    or p_next_status not in ('open', 'pending_customer')
    or length(p_body) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'INVALID_SUPPORT_REPLY';
  end if;
  perform 1 from public.support_conversations where id = p_conversation_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'SUPPORT_NOT_FOUND'; end if;
  insert into public.support_messages(conversation_id, sender_type, body)
  values (p_conversation_id, p_sender_type, p_body);
  update public.support_conversations
  set status = p_next_status, last_message_at = now()
  where id = p_conversation_id;
end;
$$;

revoke all on function public.append_support_message(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.append_support_message(uuid, text, text, text) to service_role;

create or replace function public.consume_api_rate_limit(rate_key text, maximum_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare allowed boolean;
begin
  if char_length(rate_key) not between 16 and 200 or maximum_hits not between 1 and 10000 or window_seconds not between 1 and 604800 then
    return false;
  end if;
  insert into public.api_rate_limits as limits (key, window_started_at, hits)
  values (rate_key, now(), 1)
  on conflict (key) do update set
    window_started_at = case when limits.window_started_at <= now() - make_interval(secs => window_seconds) then now() else limits.window_started_at end,
    hits = case when limits.window_started_at <= now() - make_interval(secs => window_seconds) then 1 else least(limits.hits + 1, maximum_hits + 1) end
  returning hits <= maximum_hits into allowed;
  if random() < 0.01 then
    delete from public.api_rate_limits where window_started_at < now() - interval '8 days';
  end if;
  return allowed;
end;
$$;

create or replace function public.valid_customer_cart(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) > 100 then return false; end if;
  for item in select entry from jsonb_array_elements(value) as entries(entry) loop
    if jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item->'productId') <> 'string'
      or length(item->>'productId') not between 1 and 180
      or jsonb_typeof(item->'variantId') <> 'string'
      or length(item->>'variantId') not between 3 and 255
      or jsonb_typeof(item->'quantity') <> 'number'
      or (item->>'quantity') !~ '^[0-9]+$'
      or length(item->>'quantity') > 2 then return false; end if;
    if (item->>'quantity')::integer not between 1 and 20 then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.valid_customer_cart(jsonb) from public;
grant execute on function public.valid_customer_cart(jsonb) to authenticated;
alter table public.customer_carts drop constraint if exists customer_carts_items_shape;
alter table public.customer_carts add constraint customer_carts_items_shape
  check (public.valid_customer_cart(items)) not valid;

alter table public.customer_wishlist drop constraint if exists customer_wishlist_product_fk;
alter table public.customer_wishlist add constraint customer_wishlist_product_fk
  foreign key (product_id) references public.products(id) on delete cascade not valid;

alter table public.profiles drop constraint if exists profiles_extended_fields_valid;
alter table public.profiles add constraint profiles_extended_fields_valid check (
  (first_name is null or char_length(first_name) between 1 and 80)
  and (last_name is null or char_length(last_name) between 1 and 80)
  and (phone is null or (char_length(phone) between 8 and 24 and phone ~ '^[+0-9() .-]+$'))
  and (avatar_url is null or (char_length(avatar_url) <= 1000 and avatar_url ~ '^https://'))
) not valid;

alter table public.customer_addresses drop constraint if exists customer_addresses_optional_fields_valid;
alter table public.customer_addresses add constraint customer_addresses_optional_fields_valid check (
  (address_line2 is null or char_length(address_line2) <= 180)
  and (region is null or char_length(region) <= 100)
  and (postal_code is null or char_length(postal_code) <= 24)
  and (phone ~ '^[+0-9() .-]+$')
) not valid;

create index if not exists profiles_created_idx on public.profiles(created_at desc);
create index if not exists customer_addresses_user_default_created_idx
  on public.customer_addresses(user_id, is_default desc, created_at desc);

create or replace function public.list_admin_customers(p_page integer, p_page_size integer, p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offset integer;
  v_total bigint;
  v_customers jsonb;
  v_search text := lower(trim(coalesce(p_search, '')));
begin
  if p_page not between 1 and 10000 or p_page_size not between 1 and 100 or length(v_search) > 80 then
    raise exception using errcode = '22023', message = 'INVALID_PAGINATION';
  end if;
  v_offset := (p_page - 1) * p_page_size;
  select count(*) into v_total
  from public.profiles p join auth.users u on u.id = p.user_id
  where v_search = ''
    or lower(coalesce(u.email, '') || ' ' || coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '') || ' ' || coalesce(p.phone, '')) like '%' || v_search || '%'
    or exists (select 1 from public.customer_addresses a where a.user_id = p.user_id and lower(a.city) like '%' || v_search || '%');

  select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) into v_customers from (
    select
      p.user_id as uid,
      jsonb_build_object(
        'firstName', p.first_name, 'lastName', p.last_name,
        'displayName', p.display_name, 'phone', p.phone, 'email', u.email,
        'city', address.city
      ) as profile,
      p.created_at as "createdAt",
      coalesce(order_stats.order_count, 0) as "orderCount"
    from public.profiles p
    join auth.users u on u.id = p.user_id
    left join lateral (
      select a.city from public.customer_addresses a
      where a.user_id = p.user_id order by a.is_default desc, a.created_at desc limit 1
    ) address on true
    left join lateral (
      select count(*) as order_count from public.orders o where o.user_id = p.user_id
    ) order_stats on true
    where v_search = ''
      or lower(coalesce(u.email, '') || ' ' || coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '') || ' ' || coalesce(p.phone, '')) like '%' || v_search || '%'
      or lower(coalesce(address.city, '')) like '%' || v_search || '%'
    order by p.created_at desc
    limit p_page_size offset v_offset
  ) rows;
  return jsonb_build_object('customers', v_customers, 'pagination', jsonb_build_object('page', p_page, 'pageSize', p_page_size, 'total', v_total));
end;
$$;

revoke all on function public.list_admin_customers(integer, integer, text) from public, anon, authenticated;
grant execute on function public.list_admin_customers(integer, integer, text) to service_role;
