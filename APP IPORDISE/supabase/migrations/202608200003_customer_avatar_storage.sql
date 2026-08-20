-- Publicly readable profile photos with writes isolated to the authenticated
-- customer's own folder. Profile images contain no authentication secrets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-avatars',
  'customer-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists customer_avatar_public_read on storage.objects;
create policy customer_avatar_public_read on storage.objects for select
  using (bucket_id = 'customer-avatars');

drop policy if exists customer_avatar_owner_insert on storage.objects;
create policy customer_avatar_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists customer_avatar_owner_update on storage.objects;
create policy customer_avatar_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'customer-avatars' and owner_id = auth.uid()::text)
  with check (
    bucket_id = 'customer-avatars'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists customer_avatar_owner_delete on storage.objects;
create policy customer_avatar_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'customer-avatars' and owner_id = auth.uid()::text);
