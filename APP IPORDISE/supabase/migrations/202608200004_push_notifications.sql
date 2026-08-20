-- Additive push infrastructure; existing customer, order, and product data is preserved.
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  installation_id uuid not null unique,
  expo_push_token text not null unique check (char_length(expo_push_token) between 20 and 300),
  platform text not null check (platform in ('android','ios')),
  provider text not null default 'expo' check (provider = 'expo'),
  language text not null default 'fr' check (language in ('fr','en','ar')),
  app_version text,
  enabled boolean not null default true,
  new_products_enabled boolean not null default false,
  order_updates_enabled boolean not null default false,
  offers_enabled boolean not null default false,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences drop constraint if exists notification_preferences_order_updates_check;
create index if not exists push_devices_new_products_idx on public.push_devices(language, updated_at) where enabled and new_products_enabled;
create index if not exists push_devices_user_idx on public.push_devices(user_id) where user_id is not null;
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;
grant all on public.push_devices to service_role;

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('NEW_PRODUCT','ORDER_UPDATE','PROMOTION')),
  product_id text references public.products(id) on delete set null,
  title jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','partial','failed')),
  attempted_count integer not null default 0,
  accepted_count integer not null default 0,
  failed_count integer not null default 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(type, product_id)
);
alter table public.push_campaigns enable row level security;
revoke all on public.push_campaigns from anon, authenticated;
grant all on public.push_campaigns to service_role;

create table if not exists public.push_tickets (
  id text primary key,
  campaign_id uuid not null references public.push_campaigns(id) on delete cascade,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists push_tickets_unchecked_idx on public.push_tickets(created_at) where checked_at is null;
alter table public.push_tickets enable row level security;
revoke all on public.push_tickets from anon, authenticated;
grant all on public.push_tickets to service_role;

drop trigger if exists push_devices_updated_at on public.push_devices;
create trigger push_devices_updated_at before update on public.push_devices for each row execute function public.set_updated_at();
drop trigger if exists push_campaigns_updated_at on public.push_campaigns;
create trigger push_campaigns_updated_at before update on public.push_campaigns for each row execute function public.set_updated_at();
