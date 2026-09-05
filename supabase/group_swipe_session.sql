-- Run this in the Supabase SQL editor before testing group swiping.

-- Shared signal so every member's lobby screen knows swiping has begun.
alter table groups add column if not exists started_at timestamptz;

-- Realtime coverage for the new pieces this feature depends on:
-- - `groups` UPDATE events (started_at being set) move everyone from lobby to the swipe deck
-- - `swipes` INSERT events power the live "X of Y have finished" progress indicator
alter publication supabase_realtime add table groups;
alter publication supabase_realtime add table swipes;
