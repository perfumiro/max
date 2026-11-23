-- Only signal after the admin API has completed its product and variant writes.
-- Do not send private audit metadata, draft data, or staff identities.
create or replace function public.signal_catalog_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{}'::jsonb, 'changed', 'storefront-catalog', true);
  return new;
end;
$$;
revoke all on function public.signal_catalog_publication() from public, anon, authenticated;
drop trigger if exists catalog_publication_completed on public.admin_audit_logs;
create trigger catalog_publication_completed after insert on public.admin_audit_logs
for each row when (new.action = 'catalog.sync')
execute function public.signal_catalog_publication();

drop policy if exists "Read storefront catalog change signals" on realtime.messages;
create policy "Read storefront catalog change signals"
on realtime.messages for select to anon, authenticated
using (extension = 'broadcast' and realtime.topic() = 'storefront-catalog');
