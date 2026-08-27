-- 48-hour product promotions are stored on the canonical product and variant
-- records, expire server-side, and can notify the same opted-in installation
-- more than once when a genuinely new promotion window is launched.

alter table public.push_campaigns
  add column if not exists dedupe_key text;

update public.push_campaigns
set dedupe_key = type || ':' || coalesce(product_id, id::text)
where dedupe_key is null;

alter table public.push_campaigns
  alter column dedupe_key set not null;

alter table public.push_campaigns
  drop constraint if exists push_campaigns_type_product_id_key;

create unique index if not exists push_campaigns_dedupe_key_idx
  on public.push_campaigns(dedupe_key);

create index if not exists push_devices_offers_idx
  on public.push_devices(language, updated_at)
  where enabled and offers_enabled;

create or replace function public.expire_product_promotions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired integer := 0;
begin
  -- Restore every variant before clearing the product promotion metadata so
  -- checkout and catalogue reads move back to the same regular price atomically.
  update public.product_variants pv
  set
    price_minor = round((p.base_sizes->>pv.size_key)::numeric * 100)::bigint,
    compare_at_price_minor = null,
    updated_at = now()
  from public.products p
  where p.id = pv.product_id
    and p.offer_end is not null
    and p.offer_end <= now()
    and jsonb_typeof(p.base_sizes->pv.size_key) = 'number'
    and (p.base_sizes->>pv.size_key)::numeric > 0;

  update public.products
  set
    sizes = case when base_sizes <> '{}'::jsonb then base_sizes else sizes end,
    original_prices = '{}'::jsonb,
    offer_start = null,
    offer_end = null,
    offer_featured = false,
    offer_badge = null,
    offer_display_order = 100,
    badge = case when badge in ('OFFER', '48H OFFER') then null else badge end,
    updated_at = now()
  where offer_end is not null and offer_end <= now();

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function public.expire_product_promotions() from public, anon, authenticated;
grant execute on function public.expire_product_promotions() to service_role;

-- Checkout performs a final expiry pass in the same server-side transaction.
-- This protects the exact 48-hour boundary even if the scheduled cleanup is late.
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
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.expire_product_promotions();
  return public.create_commerce_order(
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
end;
$$;

revoke all on function public.create_commerce_order_safe(uuid, jsonb, jsonb, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_commerce_order_safe(uuid, jsonb, jsonb, text, text, text, text)
  to service_role;

-- Supabase provides pg_cron. The checkout guard above remains authoritative;
-- this job keeps browsing clients fresh even when no checkout is taking place.
create extension if not exists pg_cron with schema extensions;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'expire-ipordise-48h-promotions' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'expire-ipordise-48h-promotions',
    '* * * * *',
    'select public.expire_product_promotions();'
  );
exception
  when insufficient_privilege then
    raise notice 'pg_cron scheduling skipped; checkout expiry protection remains active';
end;
$$;
