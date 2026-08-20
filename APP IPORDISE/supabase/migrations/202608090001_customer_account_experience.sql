-- Non-destructive customer account additions. Existing users, profiles and orders are preserved.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles alter column user_id set default auth.uid();

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, first_name, last_name, phone, locale, currency, marketing_consent)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), ''),
    'fr-MA', 'MAD', coalesce((new.raw_user_meta_data->>'marketing_consent')::boolean, false)
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_customer_created on auth.users;
create trigger on_auth_customer_created after insert on auth.users for each row execute function public.handle_new_customer();

-- Repair profiles for existing Auth users without changing existing profile values.
insert into public.profiles (user_id, display_name, first_name, last_name, phone, locale, currency, marketing_consent)
select u.id,
  nullif(trim(coalesce(u.raw_user_meta_data->>'display_name', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data->>'first_name', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data->>'last_name', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data->>'phone', '')), ''),
  'fr-MA', 'MAD', coalesce((u.raw_user_meta_data->>'marketing_consent')::boolean, false)
from auth.users u
on conflict (user_id) do nothing;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null default 'Maison' check (char_length(label) between 1 and 40),
  recipient_name text not null check (char_length(recipient_name) between 2 and 100),
  phone text not null check (char_length(phone) between 8 and 24),
  address_line1 text not null check (char_length(address_line1) between 4 and 180),
  address_line2 text,
  city text not null check (char_length(city) between 2 and 80),
  region text,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_one_default_address on public.customer_addresses(user_id) where is_default;
create or replace function public.customer_address_make_default()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.is_default then
    update public.customer_addresses set is_default = false where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;
drop trigger if exists customer_address_default on public.customer_addresses;
create trigger customer_address_default before insert or update of is_default on public.customer_addresses for each row execute function public.customer_address_make_default();
drop trigger if exists customer_addresses_updated_at on public.customer_addresses;
create trigger customer_addresses_updated_at before update on public.customer_addresses for each row execute function public.set_updated_at();
alter table public.customer_addresses enable row level security;
drop policy if exists customer_addresses_own on public.customer_addresses;
create policy customer_addresses_own on public.customer_addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  order_updates boolean not null default true check (order_updates = true),
  security_alerts boolean not null default true check (security_alerts = true),
  back_in_stock boolean not null default true,
  wishlist_price_changes boolean not null default true,
  new_products boolean not null default false,
  offers_marketing boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.customer_wishlist (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id text not null check (char_length(product_id) between 1 and 180),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.customer_wishlist enable row level security;
drop policy if exists customer_wishlist_own on public.customer_wishlist;
create policy customer_wishlist_own on public.customer_wishlist for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.customer_carts (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now()
);
alter table public.customer_carts enable row level security;
drop trigger if exists customer_carts_updated_at on public.customer_carts;
create trigger customer_carts_updated_at before update on public.customer_carts for each row execute function public.set_updated_at();
drop policy if exists customer_carts_own on public.customer_carts;
create policy customer_carts_own on public.customer_carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','processing','ready','expired')), created_at timestamptz not null default now()
);
alter table public.data_export_requests enable row level security;
drop policy if exists data_export_requests_own on public.data_export_requests;
create policy data_export_requests_own on public.data_export_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists data_export_requests_create on public.data_export_requests;
create policy data_export_requests_create on public.data_export_requests for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','reviewing','completed','cancelled')), created_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
drop policy if exists account_deletion_requests_own on public.account_deletion_requests;
create policy account_deletion_requests_own on public.account_deletion_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists account_deletion_requests_create on public.account_deletion_requests;
create policy account_deletion_requests_create on public.account_deletion_requests for insert to authenticated with check (user_id = auth.uid());

grant select, insert, update, delete on public.customer_addresses, public.notification_preferences, public.customer_wishlist, public.customer_carts to authenticated;
grant select, insert on public.data_export_requests, public.account_deletion_requests to authenticated;

-- Server-only fixed-window rate limits for public Edge Function entry points.
create table if not exists public.api_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 1 check (hits > 0)
);
alter table public.api_rate_limits enable row level security;

create or replace function public.consume_api_rate_limit(rate_key text, maximum_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare allowed boolean;
begin
  if char_length(rate_key) < 16 or maximum_hits < 1 or window_seconds < 1 then
    return false;
  end if;
  insert into public.api_rate_limits as limits (key, window_started_at, hits)
  values (rate_key, now(), 1)
  on conflict (key) do update set
    window_started_at = case when limits.window_started_at <= now() - make_interval(secs => window_seconds) then now() else limits.window_started_at end,
    hits = case when limits.window_started_at <= now() - make_interval(secs => window_seconds) then 1 else limits.hits + 1 end
  returning hits <= maximum_hits into allowed;
  return allowed;
end;
$$;
revoke all on table public.api_rate_limits from anon, authenticated;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
