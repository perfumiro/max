-- Preserve historical preorder/customer snapshots when a catalogue product is deleted.
-- This prevents preorder rows from breaking the existing admin product deletion flow.
alter table public.preorder_requests
  alter column product_id drop not null;

alter table public.preorder_requests
  drop constraint if exists preorder_requests_product_id_fkey,
  add constraint preorder_requests_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;

alter table public.preorder_requests
  drop constraint if exists preorder_requests_variant_id_fkey,
  add constraint preorder_requests_variant_id_fkey
    foreign key (variant_id) references public.product_variants(id) on delete set null;
