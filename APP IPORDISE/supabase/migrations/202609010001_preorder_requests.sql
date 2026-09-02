alter table public.products
  add column if not exists preorder_enabled boolean not null default false,
  add column if not exists preorder_message text,
  add column if not exists preorder_estimated_availability text;

create table if not exists public.preorder_requests (
  id uuid primary key default gen_random_uuid(),
  product_id text references public.products(id) on delete set null,
  variant_id text references public.product_variants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text,
  city text,
  quantity integer not null default 1,
  customer_message text,
  selected_variant text,
  product_snapshot_name text not null,
  product_snapshot_image text,
  product_snapshot_price numeric(12,2),
  source text not null,
  status text not null default 'new',
  admin_notes text,
  contacted_at timestamptz,
  converted_order_id uuid references public.orders(id) on delete set null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preorder_source_valid check (source in ('website', 'mobile_app', 'admin')),
  constraint preorder_status_valid check (status in ('new', 'contacted', 'waiting_for_stock', 'customer_confirmed', 'converted_to_order', 'cancelled', 'completed')),
  constraint preorder_quantity_valid check (quantity between 1 and 20),
  constraint preorder_name_valid check (char_length(customer_name) between 2 and 120),
  constraint preorder_phone_valid check (char_length(phone) between 10 and 20),
  constraint preorder_email_valid check (email is null or char_length(email) <= 254),
  constraint preorder_idempotency_unique unique (idempotency_key)
);

create index if not exists preorder_requests_admin_idx on public.preorder_requests (status, created_at desc);
create index if not exists preorder_requests_product_idx on public.preorder_requests (product_id, created_at desc);
create index if not exists preorder_requests_customer_idx on public.preorder_requests (phone, created_at desc);
create unique index if not exists preorder_requests_open_customer_product_unique
  on public.preorder_requests (product_id, coalesce(variant_id::text, ''), phone)
  where status in ('new', 'contacted', 'waiting_for_stock', 'customer_confirmed');

drop trigger if exists preorder_requests_updated_at on public.preorder_requests;
create trigger preorder_requests_updated_at before update on public.preorder_requests
for each row execute function public.set_updated_at();

alter table public.preorder_requests enable row level security;
revoke all on public.preorder_requests from anon, authenticated;
grant all on public.preorder_requests to service_role;

drop policy if exists preorder_requests_admin_read on public.preorder_requests;
create policy preorder_requests_admin_read on public.preorder_requests for select to authenticated
using (public.is_ipordise_admin());

update public.store_settings
set value = jsonb_set(
  coalesce(value, '{}'::jsonb),
  '{preorders}',
  coalesce(value->'preorders', jsonb_build_object(
    'enabled', true,
    'button_label', 'Request this product',
    'success_message', 'Request received. Our team will contact you.',
    'default_message', 'Currently unavailable. Leave your information and we will contact you when available.'
  )),
  true
), updated_at = now()
where id = 'main';

create or replace function public.set_preorder_global_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_settings jsonb;
begin
  update public.store_settings
  set value = jsonb_set(coalesce(value, '{}'::jsonb), '{preorders,enabled}', to_jsonb(p_enabled), true),
      updated_at = now()
  where id = 'main'
  returning value->'preorders' into v_settings;
  if v_settings is null then raise exception 'STORE_SETTINGS_MISSING'; end if;
  return v_settings;
end;
$$;
revoke all on function public.set_preorder_global_enabled(boolean) from public, anon, authenticated;
grant execute on function public.set_preorder_global_enabled(boolean) to service_role;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'preorder_requests') then
    alter publication supabase_realtime add table public.preorder_requests;
  end if;
end;
$$;
