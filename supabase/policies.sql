-- Temporary permissive policies: no auth system exists yet, so these just allow the
-- anon key to read/write freely. Replace with real scoping (e.g. by room code/membership)
-- once the app has a way to prove which group/member a request belongs to.

create policy "Allow all access to groups"
  on groups
  for all
  to public
  using (true)
  with check (true);

create policy "Allow all access to group_members"
  on group_members
  for all
  to public
  using (true)
  with check (true);

create policy "Allow all access to swipes"
  on swipes
  for all
  to public
  using (true)
  with check (true);

create policy "Allow all access to session_results"
  on session_results
  for all
  to public
  using (true)
  with check (true);
