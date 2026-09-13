-- Controls price presentation for unavailable products; stock remains authoritative.
alter table public.products
  add column if not exists price_coming_soon boolean not null default true;
