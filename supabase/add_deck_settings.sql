-- Run this in the Supabase SQL editor.
-- Holds the host's chosen deck for the current round: which pool ("cuisines" or
-- "dishes") and the exact resolved set of item names, so every member's client looks
-- up the same deck instead of each independently re-sampling it.
alter table groups add column if not exists card_type text;
alter table groups add column if not exists deck_items text[];
