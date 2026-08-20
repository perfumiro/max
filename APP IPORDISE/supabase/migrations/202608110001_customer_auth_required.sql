-- Customer checkout is account-only. Orders are created by the create-order
-- Edge Function after it verifies the customer's Supabase access token.
drop policy if exists "Public creates pending orders" on public.orders;
drop policy if exists "Customers create pending orders" on public.orders;

create policy "Authenticated customers create own pending orders"
on public.orders
for insert
to authenticated
with check (
  status = 'pending'
  and user_id = (select auth.uid())
);

revoke insert on public.orders from anon;
grant insert on public.orders to authenticated;
