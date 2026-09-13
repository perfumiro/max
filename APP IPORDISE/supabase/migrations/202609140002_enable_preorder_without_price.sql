-- Allow customers to reserve catalog products that have no published price.
-- Existing priced products retain their current preorder setting.
update public.products
set preorder_enabled = true,
    preorder_message = coalesce(nullif(preorder_message, ''), 'This fragrance is not currently priced. Reserve yours and we will contact you when it arrives.')
where active = true
  and not exists (
    select 1 from public.product_variants v
    where v.product_id = products.id
      and v.enabled = true
      and v.price_minor > 0
  )
  and not exists (
    select 1 from jsonb_each_text(coalesce(products.sizes, '{}'::jsonb)) as size(key, value)
    where (value)::numeric > 0
  );