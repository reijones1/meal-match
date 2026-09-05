-- Run this in the Supabase SQL editor.
alter table group_members add column if not exists is_host boolean not null default false;
