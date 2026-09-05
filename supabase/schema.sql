-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).

create extension if not exists pgcrypto;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists group_members_group_id_idx on group_members (group_id);

create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  member_id uuid not null references group_members (id) on delete cascade,
  cuisine_name text not null,
  liked boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists swipes_group_id_idx on swipes (group_id);
create index if not exists swipes_member_id_idx on swipes (member_id);

create table if not exists session_results (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  winning_cuisine text not null,
  decided_at timestamptz not null default now()
);

create index if not exists session_results_group_id_idx on session_results (group_id);
