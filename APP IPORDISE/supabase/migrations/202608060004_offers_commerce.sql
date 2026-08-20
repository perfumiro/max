alter table public.products
  add column if not exists offer_start timestamptz,
  add column if not exists offer_end timestamptz,
  add column if not exists offer_featured boolean not null default false,
  add column if not exists offer_badge text,
  add column if not exists offer_display_order integer not null default 100;

alter table public.products drop constraint if exists products_offer_dates_valid;
alter table public.products add constraint products_offer_dates_valid
  check (offer_start is null or offer_end is null or offer_end > offer_start);

create or replace function public.validate_product_offer_prices()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  size_key text;
  original_value numeric;
  sale_value numeric;
begin
  for size_key, original_value in select key, value::numeric from jsonb_each_text(new.original_prices)
  loop
    sale_value := nullif(new.sizes->>size_key, '')::numeric;
    if sale_value is null or sale_value >= original_value then
      raise exception 'Sale price for % must be lower than its original price', size_key;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists products_validate_offer_prices on public.products;
create trigger products_validate_offer_prices
before insert or update of sizes, original_prices on public.products
for each row execute function public.validate_product_offer_prices();

create index if not exists products_offer_schedule_idx
  on public.products (active, offer_featured, offer_display_order, offer_end);

update public.store_settings
set value = value || jsonb_build_object('offers', coalesce(value->'offers', '{
  "eyebrow":"PRIVATE PRICES · LIMITED TIME",
  "heading":"Exceptional scents. Special prices.",
  "description":"Selected fragrance offers and private discovery privileges, curated for Morocco.",
  "ctaLabel":"SHOP ALL OFFERS.",
  "destination":"offers",
  "backgroundImage":"",
  "mobileImage":"",
  "tabletImage":"",
  "active":true,
  "startsAt":"",
  "endsAt":""
}'::jsonb))
where id = 'main';
