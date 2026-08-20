drop policy if exists "Customers create pending orders" on public.orders;
revoke insert on public.orders from anon, authenticated;

create policy "Admins update orders" on public.orders for update to authenticated
using (public.is_ipordise_admin()) with check (public.is_ipordise_admin());

create index if not exists orders_customer_phone_idx on public.orders ((customer->>'phone'), created_at desc);
