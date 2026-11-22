-- Daybook sync table. Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Each person can only ever read and write their own rows (row-level security).

create table if not exists public.items (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  updated_at  bigint not null,
  deleted     boolean not null default false,
  synced_at   timestamptz not null default clock_timestamp()
);

create index if not exists items_user_synced on public.items (user_id, synced_at);

-- Every write gets a fresh server timestamp, so devices can ask "what changed since I last looked?"
create or replace function public.items_touch() returns trigger
language plpgsql as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
  for each row execute function public.items_touch();

alter table public.items enable row level security;

drop policy if exists "own rows: read"   on public.items;
drop policy if exists "own rows: insert" on public.items;
drop policy if exists "own rows: update" on public.items;
drop policy if exists "own rows: delete" on public.items;

create policy "own rows: read"   on public.items for select using (auth.uid() = user_id);
create policy "own rows: insert" on public.items for insert with check (auth.uid() = user_id);
create policy "own rows: update" on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.items for delete using (auth.uid() = user_id);
