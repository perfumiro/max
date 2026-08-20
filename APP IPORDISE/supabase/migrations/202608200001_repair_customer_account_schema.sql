-- Repair production installations that received commerce functions before the
-- customer-account migrations were registered. All operations are additive or
-- idempotent so existing products, orders, auth users, and settings are kept.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  locale text not null default 'fr-MA',
  currency text not null default 'MAD',
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text;
alter table public.profiles alter column user_id set default auth.uid();
alter table public.profiles enable row level security;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.profiles to authenticated;

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id, display_name, first_name, last_name, phone, locale, currency, marketing_consent
  ) values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), ''),
    'fr-MA',
    'MAD',
    coalesce((new.raw_user_meta_data->>'marketing_consent')::boolean, false)
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_customer_created on auth.users;
create trigger on_auth_customer_created
  after insert on auth.users for each row execute function public.handle_new_customer();

insert into public.profiles (
  user_id, display_name, first_name, last_name, phone, locale, currency, marketing_consent
)
select
  user_row.id,
  nullif(trim(coalesce(user_row.raw_user_meta_data->>'display_name', '')), ''),
  nullif(trim(coalesce(user_row.raw_user_meta_data->>'first_name', '')), ''),
  nullif(trim(coalesce(user_row.raw_user_meta_data->>'last_name', '')), ''),
  nullif(trim(coalesce(user_row.raw_user_meta_data->>'phone', '')), ''),
  'fr-MA',
  'MAD',
  coalesce((user_row.raw_user_meta_data->>'marketing_consent')::boolean, false)
from auth.users user_row
on conflict (user_id) do nothing;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null default 'Maison',
  recipient_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customer_one_default_address
  on public.customer_addresses(user_id) where is_default;
create or replace function public.customer_address_make_default()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.is_default then
    update public.customer_addresses
      set is_default = false
      where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;
drop trigger if exists customer_address_default on public.customer_addresses;
create trigger customer_address_default before insert or update of is_default
  on public.customer_addresses for each row execute function public.customer_address_make_default();
alter table public.customer_addresses enable row level security;
drop policy if exists customer_addresses_own on public.customer_addresses;
create policy customer_addresses_own on public.customer_addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.customer_addresses to authenticated;

create table if not exists public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  order_updates boolean not null default true,
  security_alerts boolean not null default true,
  back_in_stock boolean not null default true,
  wishlist_price_changes boolean not null default true,
  new_products boolean not null default false,
  offers_marketing boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.notification_preferences to authenticated;

create table if not exists public.customer_wishlist (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.customer_wishlist enable row level security;
drop policy if exists customer_wishlist_own on public.customer_wishlist;
create policy customer_wishlist_own on public.customer_wishlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.customer_wishlist to authenticated;

create table if not exists public.customer_carts (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.customer_carts enable row level security;
drop policy if exists customer_carts_own on public.customer_carts;
create policy customer_carts_own on public.customer_carts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.customer_carts to authenticated;

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);
alter table public.data_export_requests enable row level security;
drop policy if exists data_export_requests_own on public.data_export_requests;
create policy data_export_requests_own on public.data_export_requests for select to authenticated
  using (user_id = auth.uid());
drop policy if exists data_export_requests_create on public.data_export_requests;
create policy data_export_requests_create on public.data_export_requests for insert to authenticated
  with check (user_id = auth.uid());
grant select, insert on public.data_export_requests to authenticated;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
drop policy if exists account_deletion_requests_own on public.account_deletion_requests;
create policy account_deletion_requests_own on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid());
drop policy if exists account_deletion_requests_create on public.account_deletion_requests;
create policy account_deletion_requests_create on public.account_deletion_requests for insert to authenticated
  with check (user_id = auth.uid());
grant select, insert on public.account_deletion_requests to authenticated;

alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_created_idx
  on public.orders(user_id, created_at desc) where user_id is not null;
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders" on public.orders for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_idx
  on public.order_status_history(order_id, created_at);
alter table public.order_status_history enable row level security;
drop policy if exists order_status_history_customer_read on public.order_status_history;
create policy order_status_history_customer_read on public.order_status_history for select to authenticated
  using (exists (
    select 1 from public.orders order_row
    where order_row.id = order_id and order_row.user_id = auth.uid()
  ));
grant select on public.order_status_history to authenticated;
grant all on public.order_status_history to service_role;

notify pgrst, 'reload schema';
