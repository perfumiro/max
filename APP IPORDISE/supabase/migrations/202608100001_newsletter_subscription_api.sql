create or replace function public.subscribe_newsletter(subscriber_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(coalesce(subscriber_email, '')));
begin
  if length(normalized_email) > 254
    or normalized_email !~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  then
    raise exception using errcode = '22023', message = 'A valid email address is required.';
  end if;

  if exists (
    select 1
    from public.newsletter_subscribers
    where email = normalized_email and active = true
  ) then
    return 'already_subscribed';
  end if;

  insert into public.newsletter_subscribers (email, active)
  values (normalized_email, true)
  on conflict (email) do update
  set active = true,
      updated_at = now();

  return 'subscribed';
end;
$$;

revoke all on function public.subscribe_newsletter(text) from public;
grant execute on function public.subscribe_newsletter(text) to anon, authenticated;

revoke insert on public.newsletter_subscribers from anon;
