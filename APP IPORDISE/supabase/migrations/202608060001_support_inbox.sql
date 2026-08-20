create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null check (position('@' in customer_email) > 1),
  order_number text check (order_number is null or char_length(order_number) between 2 and 80),
  subject text not null check (char_length(subject) between 2 and 120),
  status text not null default 'open' check (status in ('open', 'pending_customer', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  client_token_hash text not null unique,
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'staff')),
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists support_conversations_inbox_idx on public.support_conversations (status, last_message_at desc);
create index if not exists support_messages_thread_idx on public.support_messages (conversation_id, created_at);
create index if not exists support_conversations_email_idx on public.support_conversations (lower(customer_email), created_at desc);

drop trigger if exists support_conversations_updated_at on public.support_conversations;
create trigger support_conversations_updated_at before update on public.support_conversations
for each row execute function public.set_updated_at();

create or replace function public.has_ipordise_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and active and role = any(allowed_roles)
  );
$$;

revoke all on function public.has_ipordise_role(text[]) from public;
grant execute on function public.has_ipordise_role(text[]) to authenticated;

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

create policy "Staff reads support conversations" on public.support_conversations for select to authenticated
using (public.has_ipordise_role(array['admin','support']));
create policy "Staff updates support conversations" on public.support_conversations for update to authenticated
using (public.has_ipordise_role(array['admin','support'])) with check (public.has_ipordise_role(array['admin','support']));
create policy "Staff reads support messages" on public.support_messages for select to authenticated
using (public.has_ipordise_role(array['admin','support']));
create policy "Staff creates support replies" on public.support_messages for insert to authenticated
with check (sender_type = 'staff' and sender_user_id = (select auth.uid()) and public.has_ipordise_role(array['admin','support']));
create policy "Staff marks support messages read" on public.support_messages for update to authenticated
using (public.has_ipordise_role(array['admin','support'])) with check (public.has_ipordise_role(array['admin','support']));

grant select, update on public.support_conversations to authenticated;
grant select, insert, update on public.support_messages to authenticated;
grant usage, select on sequence public.support_messages_id_seq to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages') then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;
