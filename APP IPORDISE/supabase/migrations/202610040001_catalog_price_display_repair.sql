-- Existing installations may predate the price-display option. Opt in only
-- when staff explicitly select it; never hide every existing product's price.
alter table public.products
  add column if not exists price_coming_soon boolean not null default false;
alter table public.products alter column price_coming_soon set default false;
notify pgrst, 'reload schema';
