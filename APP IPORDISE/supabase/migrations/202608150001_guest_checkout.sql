-- Guest checkout remains server-only: the Edge Function validates input,
-- rate-limits requests, recomputes prices, locks stock and calls this RPC with
-- the service role. A null user_id distinguishes guest orders in administration.
do $migration$
declare
  definition text;
  auth_guard constant text := 'if p_user_id is null then raise exception using errcode = ''22023'', message = ''AUTH_REQUIRED''; end if;';
begin
  select pg_get_functiondef('public.create_commerce_order(uuid,jsonb,jsonb,text,text,text,text)'::regprocedure)
  into definition;
  if position(lower(auth_guard) in lower(definition)) = 0 then
    raise exception 'Expected create_commerce_order authentication guard was not found';
  end if;
  definition := regexp_replace(
    definition,
    'if\s+p_user_id\s+is\s+null\s+then\s+raise\s+exception\s+using\s+errcode\s*=\s*''22023'',\s*message\s*=\s*''AUTH_REQUIRED'';\s*end\s+if;',
    '-- Guest orders intentionally use a null user_id.',
    'i'
  );
  execute definition;
end;
$migration$;

comment on function public.create_commerce_order(uuid, jsonb, jsonb, text, text, text, text)
is 'Server-only atomic checkout for authenticated and rate-limited guest customers.';
