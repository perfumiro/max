create table if not exists public.product_review_verifications (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  email_hash text not null check (char_length(email_hash) = 64),
  code_hash text not null check (char_length(code_hash) = 64),
  attempts smallint not null default 0 check (attempts between 0 and 8),
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  reviewer_email_hash text not null check (char_length(reviewer_email_hash) = 64),
  reviewer_name text not null check (char_length(reviewer_name) between 1 and 80),
  reviewer_city text check (reviewer_city is null or char_length(reviewer_city) <= 100),
  purchased_size text check (purchased_size is null or char_length(purchased_size) <= 30),
  rating smallint not null check (rating between 1 and 5),
  title text not null check (char_length(title) between 3 and 100),
  body text not null check (char_length(body) between 15 and 1200),
  status text not null default 'published' check (status in ('pending','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create index if not exists product_reviews_product_created_idx on public.product_reviews (product_id, created_at desc) where status = 'published';
create index if not exists product_review_verifications_expiry_idx on public.product_review_verifications (expires_at);
create index if not exists orders_customer_email_idx on public.orders ((lower(customer->>'email')), created_at desc) where customer->>'email' is not null;

drop trigger if exists product_reviews_updated_at on public.product_reviews;
create trigger product_reviews_updated_at before update on public.product_reviews for each row execute function public.set_updated_at();

alter table public.product_review_verifications enable row level security;
alter table public.product_reviews enable row level security;

create policy "Admins manage product reviews" on public.product_reviews for all to authenticated
using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());

revoke all on public.product_review_verifications from public, anon, authenticated;
revoke all on public.product_reviews from public, anon, authenticated;
grant all on public.product_review_verifications, public.product_reviews to service_role;
grant select, update on public.product_reviews to authenticated;
