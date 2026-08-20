-- Third hostile pass: serialize abuse counters, prevent forged self-service
-- workflow state, bound user collections, and restore operational audit data.

alter table public.admin_audit_logs add column if not exists admin_email text;
alter table public.admin_audit_logs drop constraint if exists admin_audit_email_valid;
alter table public.admin_audit_logs add constraint admin_audit_email_valid check (
  admin_email is null or (char_length(admin_email) between 3 and 254 and admin_email = lower(admin_email))
) not valid;

create or replace function public.create_commerce_order_safe(
  p_user_id uuid,
  p_customer jsonb,
  p_requested_items jsonb,
  p_idempotency_key text,
  p_request_hash text,
  p_notes text default null,
  p_source text default 'mobile_app'
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.create_commerce_order(
    p_user_id,
    p_customer,
    coalesce((
      select jsonb_agg(item order by item->>'variantId')
      from jsonb_array_elements(p_requested_items) item
    ), '[]'::jsonb),
    p_idempotency_key,
    p_request_hash,
    p_notes,
    p_source
  );
$$;
revoke all on function public.create_commerce_order_safe(uuid, jsonb, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_commerce_order_safe(uuid, jsonb, jsonb, text, text, text, text) to service_role;

drop policy if exists data_export_requests_create on public.data_export_requests;
create policy data_export_requests_create on public.data_export_requests for insert to authenticated
with check (
  user_id = (select auth.uid()) and status = 'requested'
  and created_at between now() - interval '5 minutes' and now() + interval '1 minute'
);

drop policy if exists account_deletion_requests_create on public.account_deletion_requests;
create policy account_deletion_requests_create on public.account_deletion_requests for insert to authenticated
with check (
  user_id = (select auth.uid()) and status = 'requested'
  and created_at between now() - interval '5 minutes' and now() + interval '1 minute'
);

with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc, id desc) as position
  from public.data_export_requests where status in ('requested', 'processing')
)
update public.data_export_requests set status = 'expired'
where id in (select id from ranked where position > 1);
with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc, id desc) as position
  from public.account_deletion_requests where status in ('requested', 'reviewing')
)
update public.account_deletion_requests set status = 'cancelled'
where id in (select id from ranked where position > 1);

create unique index if not exists data_export_one_active_request
  on public.data_export_requests(user_id) where status in ('requested', 'processing');
create unique index if not exists account_deletion_one_active_request
  on public.account_deletion_requests(user_id) where status in ('requested', 'reviewing');

create or replace function public.enforce_customer_collection_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || tg_table_name, 0));
  if tg_table_name = 'customer_addresses' then
    select count(*) into v_count from public.customer_addresses where user_id = new.user_id;
    if v_count >= 20 then raise exception using errcode = 'P0001', message = 'ADDRESS_LIMIT_REACHED'; end if;
  elsif tg_table_name = 'customer_wishlist' then
    select count(*) into v_count from public.customer_wishlist where user_id = new.user_id;
    if v_count >= 200 and not exists (
      select 1 from public.customer_wishlist where user_id = new.user_id and product_id = new.product_id
    ) then raise exception using errcode = 'P0001', message = 'WISHLIST_LIMIT_REACHED'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_customer_collection_limit() from public, anon, authenticated;
drop trigger if exists customer_addresses_limit on public.customer_addresses;
create trigger customer_addresses_limit before insert on public.customer_addresses
for each row execute function public.enforce_customer_collection_limit();
drop trigger if exists customer_wishlist_limit on public.customer_wishlist;
create trigger customer_wishlist_limit before insert on public.customer_wishlist
for each row execute function public.enforce_customer_collection_limit();

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
  if p_sender_type = 'customer' and (
    select count(*) from public.support_messages
    where conversation_id = p_conversation_id and sender_type = 'customer'
      and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception using errcode = 'P0001', message = 'SUPPORT_MESSAGE_RATE_LIMITED';
  end if;
  insert into public.support_messages(conversation_id, sender_type, body)
  values (p_conversation_id, p_sender_type, p_body);
  update public.support_conversations
  set status = p_next_status, last_message_at = now()
  where id = p_conversation_id;
end;
$$;
revoke all on function public.append_support_message(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.append_support_message(uuid, text, text, text) to service_role;

create or replace function public.verify_product_review_code(
  p_verification_id uuid,
  p_product_id text,
  p_email_hash text,
  p_code_hash text,
  p_mark_verified boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.product_review_verifications%rowtype;
begin
  select * into v_row from public.product_review_verifications
  where id = p_verification_id and product_id = p_product_id for update;
  if not found then return false; end if;
  if v_row.consumed_at is not null or v_row.expires_at <= now() or v_row.attempts >= 8
    or v_row.email_hash <> p_email_hash or v_row.code_hash <> p_code_hash then
    if v_row.consumed_at is null and v_row.attempts < 8 then
      update public.product_review_verifications
      set attempts = least(8, attempts + 1) where id = p_verification_id;
    end if;
    return false;
  end if;
  if p_mark_verified then
    update public.product_review_verifications
    set verified_at = coalesce(verified_at, now()) where id = p_verification_id;
  end if;
  return true;
end;
$$;
revoke all on function public.verify_product_review_code(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.verify_product_review_code(uuid, text, text, text, boolean) to service_role;

create or replace function public.product_review_summary(p_product_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'average', coalesce(round(avg(rating)::numeric, 1), 0),
    'count', count(*),
    'distribution', jsonb_build_array(
      jsonb_build_object('stars', 5, 'count', count(*) filter (where rating = 5)),
      jsonb_build_object('stars', 4, 'count', count(*) filter (where rating = 4)),
      jsonb_build_object('stars', 3, 'count', count(*) filter (where rating = 3)),
      jsonb_build_object('stars', 2, 'count', count(*) filter (where rating = 2)),
      jsonb_build_object('stars', 1, 'count', count(*) filter (where rating = 1))
    )
  )
  from public.product_reviews where product_id = p_product_id and status = 'published';
$$;
revoke all on function public.product_review_summary(text) from public, anon, authenticated;
grant execute on function public.product_review_summary(text) to service_role;

create or replace function public.admin_order_revenue_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with totals as (
    select
      coalesce(sum(total) filter (where status = 'delivered'), 0) as total_revenue,
      count(*) filter (where status = 'delivered') as delivered_count,
      coalesce(sum(total) filter (where status = 'delivered' and created_at >= date_trunc('month', now())), 0) as this_month_revenue,
      count(*) filter (where status in ('pending', 'processing')) as pending_count
    from public.orders
  ), months as (
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
      count(*) as count, coalesce(sum(total), 0) as revenue
    from public.orders where status = 'delivered'
    group by date_trunc('month', created_at)
    order by date_trunc('month', created_at) desc limit 36
  ), products as (
    select coalesce(nullif(item->>'name', ''), nullif(item->>'productName', ''), 'Unknown') as name,
      sum(case
        when jsonb_typeof(item->'lineTotal') = 'number' then (item->>'lineTotal')::numeric
        when jsonb_typeof(item->'lineTotalMinor') = 'number' then (item->>'lineTotalMinor')::numeric / 100
        else 0 end) as revenue
    from public.orders cross join lateral jsonb_array_elements(
      case when jsonb_typeof(items) = 'array' then items else '[]'::jsonb end
    ) item
    where status = 'delivered'
    group by 1 order by revenue desc limit 10
  )
  select jsonb_build_object(
    'totalRevenue', totals.total_revenue,
    'deliveredCount', totals.delivered_count,
    'averageOrder', case when totals.delivered_count > 0 then round(totals.total_revenue / totals.delivered_count) else 0 end,
    'thisMonthRevenue', totals.this_month_revenue,
    'pendingCount', totals.pending_count,
    'months', coalesce((select jsonb_agg(to_jsonb(months)) from months), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(products)) from products), '[]'::jsonb)
  ) from totals;
$$;
revoke all on function public.admin_order_revenue_summary() from public, anon, authenticated;
grant execute on function public.admin_order_revenue_summary() to service_role;

-- Customers only need read access. All order mutation now goes through the
-- service-role transaction and staff Edge API.
revoke insert, update, delete on public.orders from authenticated;
grant select on public.orders to authenticated;
