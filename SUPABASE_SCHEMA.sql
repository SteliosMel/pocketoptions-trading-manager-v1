
-- Run this in Supabase SQL Editor

-- Profiles: one row per user
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  is_admin boolean default false,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- Only the user can read/update own profile (service role bypasses RLS for admin ops)
create policy "select own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- User data json
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.user_data enable row level security;

create policy "select own data" on public.user_data for select using (auth.uid() = user_id);
create policy "upsert own data (insert)" on public.user_data for insert with check (auth.uid() = user_id);
create policy "upsert own data (update)" on public.user_data for update using (auth.uid() = user_id);

-- Optional: update updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;
drop trigger if exists trg_touch_user_data on public.user_data;
create trigger trg_touch_user_data before update on public.user_data for each row execute function public.touch_updated_at();
