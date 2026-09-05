-- Run this in the Supabase SQL editor. Tables aren't broadcast over Realtime by
-- default even with RLS/policies in place — they must be added to the
-- `supabase_realtime` publication explicitly.
alter publication supabase_realtime add table group_members;
