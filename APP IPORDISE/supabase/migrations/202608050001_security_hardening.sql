create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  role text not null default 'admin' check (role in ('admin', 'editor', 'support')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 120),
  phone text check (phone is null or char_length(phone) between 6 and 32),
  locale text not null default 'en-MA' check (char_length(locale) between 2 and 16),
  currency text not null default 'MAD' check (currency ~ '^[A-Z]{3}$'),
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 80),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Some early production installs created this table before the canonical
-- administrator identity column was introduced. CREATE TABLE IF NOT EXISTS
-- does not reconcile columns on an existing table, so make that upgrade
-- explicit before policies and indexes reference it.
alter table public.admin_audit_logs
  add column if not exists admin_user_id uuid references auth.users(id) on delete set null;

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists currency text not null default 'MAD';
alter table public.orders add column if not exists idempotency_key text;
alter table public.orders add constraint orders_currency_format check (currency ~ '^[A-Z]{3}$') not valid;
alter table public.orders add constraint orders_amounts_valid check (
  subtotal >= 0 and delivery_fee >= 0 and total >= 0 and total = subtotal + delivery_fee
) not valid;
alter table public.orders add constraint orders_items_valid check (
  jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100
) not valid;

create unique index if not exists orders_idempotency_idx on public.orders (idempotency_key) where idempotency_key is not null;
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc) where user_id is not null;
create index if not exists admin_audit_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists subscribers_email_lower_idx on public.newsletter_subscribers (lower(email));

create or replace function public.normalize_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists subscribers_normalize_email on public.newsletter_subscribers;
create trigger subscribers_normalize_email before insert or update of email on public.newsletter_subscribers
for each row execute function public.normalize_email();

drop trigger if exists admin_users_updated_at on public.admin_users;
create trigger admin_users_updated_at before update on public.admin_users for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

insert into public.admin_users (user_id, email, role)
select id, lower(email), 'admin' from auth.users where lower(email) = 'admin@ipordise.com'
on conflict (user_id) do nothing;

create or replace function public.is_ipordise_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and active and role = 'admin'
  );
$$;

revoke all on function public.is_ipordise_admin() from public;
grant execute on function public.is_ipordise_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "Admins read admin users" on public.admin_users for select to authenticated using (public.is_ipordise_admin());
create policy "Admins manage admin users" on public.admin_users for all to authenticated using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());
create policy "Users read own profile" on public.profiles for select to authenticated using (user_id = (select auth.uid()) or public.is_ipordise_admin());
create policy "Users create own profile" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own profile" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Admins read audit logs" on public.admin_audit_logs for select to authenticated using (public.is_ipordise_admin());
create policy "Admins create audit logs" on public.admin_audit_logs for insert to authenticated with check (admin_user_id = (select auth.uid()) and public.is_ipordise_admin());
create policy "Users read own orders" on public.orders for select to authenticated using (user_id = (select auth.uid()) or public.is_ipordise_admin());

drop policy if exists "Public creates pending orders" on public.orders;
create policy "Customers create pending orders" on public.orders for insert to anon, authenticated with check (
  status = 'pending' and (user_id is null or user_id = (select auth.uid()))
);

grant select, insert, update on public.profiles to authenticated;
grant select on public.admin_users, public.admin_audit_logs to authenticated;
grant insert on public.admin_audit_logs to authenticated;
