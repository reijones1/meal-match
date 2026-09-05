-- Shared, subscribable tally/decision state for a group's swipe session.
-- Exactly one row per group — the `unique` constraint on group_id is the actual
-- race guard: if two clients ever tried to write the initial tally at the same
-- moment, only one insert succeeds and the other gets a unique-violation (23505),
-- which the app catches and falls back to reading the row that won.
create table if not exists group_tallies (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade unique,
  candidate_cuisines text[] not null,
  winning_cuisine text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table group_tallies enable row level security;

create policy "Allow all access to group_tallies"
  on group_tallies
  for all
  to public
  using (true)
  with check (true);

alter publication supabase_realtime add table group_tallies;
