-- MeetPilot Phase 2 - Supabase Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Meetings table
create table if not exists meetings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  date timestamp with time zone default now(),
  duration_minutes integer default 0,
  status text default 'processing' check (status in ('processing', 'done', 'failed')),
  transcript text,
  ai_summary text,
  key_decisions jsonb default '[]',
  participants jsonb default '[]',
  audio_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Action items table
create table if not exists action_items (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references meetings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  assignee text,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  status text default 'ready' check (status in ('ready', 'in_progress', 'done')),
  jira_ticket_id text,
  jira_ticket_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS Policies
alter table meetings enable row level security;
alter table action_items enable row level security;

-- Meetings: users can only see their own
create policy "Users can view own meetings" on meetings
  for select using (auth.uid() = user_id);

create policy "Users can insert own meetings" on meetings
  for insert with check (auth.uid() = user_id);

create policy "Users can update own meetings" on meetings
  for update using (auth.uid() = user_id);

create policy "Users can delete own meetings" on meetings
  for delete using (auth.uid() = user_id);

-- Action items: same
create policy "Users can view own action items" on action_items
  for select using (auth.uid() = user_id);

create policy "Users can insert own action items" on action_items
  for insert with check (auth.uid() = user_id);

create policy "Users can update own action items" on action_items
  for update using (auth.uid() = user_id);

create policy "Users can delete own action items" on action_items
  for delete using (auth.uid() = user_id);
