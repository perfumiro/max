begin;
-- Controls price presentation for unavailable products; stock remains authoritative.
alter table public.products
  add column if not exists price_coming_soon boolean not null default true;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202609140001','product_price_coming_soon',ARRAY['-- Controls price presentation for unavailable products; stock remains authoritative.
alter table public.products
  add column if not exists price_coming_soon boolean not null default true;
']) on conflict(version) do nothing;
commit;
