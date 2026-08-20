create extension if not exists pgcrypto;

create or replace function public.is_ipordise_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(coalesce((select auth.jwt())->>'email', '')) = 'admin@ipordise.com';
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.products (
  id text primary key,
  name text not null,
  brand text not null,
  image text not null,
  gallery jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '{}'::jsonb,
  base_sizes jsonb not null default '{}'::jsonb,
  original_prices jsonb not null default '{}'::jsonb,
  filters text[] not null default '{}',
  badge text,
  description text,
  accords jsonb not null default '[]'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  ingredients text,
  rating numeric(2,1) not null default 4.8,
  review_count integer not null default 0 check (review_count >= 0),
  stock_left integer check (stock_left is null or stock_left >= 0),
  active boolean not null default true,
  source text not null default 'website' check (source in ('website','admin')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_method text not null default 'cash_on_delivery',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (position('@' in email) > 1),
  name text,
  gender text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  subject text,
  message text not null,
  status text not null default 'unread' check (status in ('unread','read','replied','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id text primary key default 'main',
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint single_store_settings check (id = 'main')
);

create index if not exists products_active_sort_idx on public.products (active, sort_order, updated_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists messages_status_created_idx on public.contact_messages (status, created_at desc);
create index if not exists notifications_read_created_idx on public.notifications (read, created_at desc);

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists subscribers_updated_at on public.newsletter_subscribers;
create trigger subscribers_updated_at before update on public.newsletter_subscribers for each row execute function public.set_updated_at();
drop trigger if exists messages_updated_at on public.contact_messages;
create trigger messages_updated_at before update on public.contact_messages for each row execute function public.set_updated_at();
drop trigger if exists settings_updated_at on public.store_settings;
create trigger settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.store_settings enable row level security;

create policy "Public reads active products" on public.products for select using (active or public.is_ipordise_admin());
create policy "Admin manages products" on public.products for all to authenticated using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());
create policy "Public creates pending orders" on public.orders for insert to anon, authenticated with check (status = 'pending');
create policy "Admin manages orders" on public.orders for all to authenticated using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());
create policy "Public subscribes" on public.newsletter_subscribers for insert to anon, authenticated with check (active = true);
create policy "Admin manages subscribers" on public.newsletter_subscribers for all to authenticated using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());
create policy "Public sends messages" on public.contact_messages for insert to anon, authenticated with check (status = 'unread');
create policy "Admin manages messages" on public.contact_messages for all to authenticated using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());
create policy "Admin manages notifications" on public.notifications for all to authenticated using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());
create policy "Public reads store settings" on public.store_settings for select using (true);
create policy "Admin manages store settings" on public.store_settings for all to authenticated using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());

insert into public.store_settings (id, value) values ('main', '{"currency":"MAD","country":"Morocco"}'::jsonb)
on conflict (id) do nothing;

grant usage on schema public to anon, authenticated;
grant select on public.products, public.store_settings to anon, authenticated;
grant insert on public.orders, public.newsletter_subscribers, public.contact_messages to anon, authenticated;
grant all on public.products, public.orders, public.newsletter_subscribers, public.contact_messages, public.notifications, public.store_settings to authenticated;

alter publication supabase_realtime add table public.products;
