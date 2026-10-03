-- Preserve existing explicit choices; new products default to visible prices.
alter table public.products alter column price_coming_soon set default false;
