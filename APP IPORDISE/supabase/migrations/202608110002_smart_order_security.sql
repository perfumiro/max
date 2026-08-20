alter table public.orders add column if not exists risk_score integer not null default 0;
alter table public.orders add column if not exists risk_level text not null default 'low';
alter table public.orders add column if not exists risk_flags jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists notification_status text not null default 'pending';

alter table public.orders drop constraint if exists orders_risk_score_valid;
alter table public.orders add constraint orders_risk_score_valid check (risk_score between 0 and 100) not valid;
alter table public.orders drop constraint if exists orders_risk_level_valid;
alter table public.orders add constraint orders_risk_level_valid check (risk_level in ('low', 'review', 'high')) not valid;
alter table public.orders drop constraint if exists orders_notification_status_valid;
alter table public.orders add constraint orders_notification_status_valid check (notification_status in ('pending', 'sent', 'partial', 'failed', 'skipped')) not valid;

create index if not exists orders_risk_created_idx on public.orders (risk_level, risk_score desc, created_at desc)
where risk_level <> 'low';

comment on column public.orders.risk_score is 'Server-derived operational review score; never accepted from checkout clients.';
comment on column public.orders.risk_flags is 'Server-derived review signals with no secrets or payment data.';
comment on column public.orders.notification_status is 'Owner/customer transactional email dispatch health.';
