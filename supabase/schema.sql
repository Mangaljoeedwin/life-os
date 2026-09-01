-- Life OS Web App v1 / Phase 2
-- Run this entire file once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create type public.task_type as enum ('daily', 'one_time', 'project_subtask');
create type public.task_area as enum ('today', 'health', 'personal', 'work', 'projects');
create type public.task_status as enum ('open', 'completed', 'archived');
create type public.completion_source as enum ('manual', 'coros', 'system');
create type public.focus_status as enum ('completed', 'cancelled');

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  height_cm numeric(5,2) not null default 178 check (height_cm between 50 and 300),
  weight_goal_kg numeric(5,2) not null default 88 check (weight_goal_kg between 20 and 500),
  weight_goal_date date not null default '2026-12-25',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  task_type public.task_type not null,
  area public.task_area not null default 'today',
  project_id uuid references public.projects(id) on delete set null,
  status public.task_status not null default 'open',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  sort_order integer not null default 0,
  due_date date,
  coros_metadata jsonb,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_task_link check (task_type <> 'project_subtask' or project_id is not null)
);

create table public.daily_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  completion_date date not null,
  is_completed boolean not null default true,
  source public.completion_source not null default 'manual',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, completion_date)
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  weight_kg numeric(5,2) not null check (weight_kg between 20 and 500),
  source public.completion_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  mode text not null,
  planned_work_minutes integer not null check (planned_work_minutes between 1 and 240),
  planned_break_minutes integer not null check (planned_break_minutes between 1 and 120),
  actual_seconds integer not null default 0 check (actual_seconds >= 0),
  started_at timestamptz not null,
  completed_at timestamptz,
  status public.focus_status not null default 'completed',
  created_at timestamptz not null default now()
);

create index tasks_user_area_idx on public.tasks (user_id, area, status, sort_order);
create index tasks_project_idx on public.tasks (project_id, sort_order);
create index daily_completions_user_date_idx on public.daily_completions (user_id, completion_date);
create index weights_user_date_idx on public.weight_entries (user_id, entry_date);
create index focus_user_started_idx on public.focus_sessions (user_id, started_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_settings_updated before update on public.user_settings for each row execute function public.set_updated_at();
create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
create trigger daily_completions_updated before update on public.daily_completions for each row execute function public.set_updated_at();
create trigger weight_entries_updated before update on public.weight_entries for each row execute function public.set_updated_at();

-- RLS is the security boundary: every signed-in person can only access their own rows.
alter table public.user_settings enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.daily_completions enable row level security;
alter table public.weight_entries enable row level security;
alter table public.focus_sessions enable row level security;

create policy "Own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own projects" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own tasks" on public.tasks for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
    ))
  );
create policy "Own completions" on public.daily_completions for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid() and t.task_type = 'daily'
    )
  );
create policy "Own weights" on public.weight_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own focus sessions" on public.focus_sessions for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (task_id is null or exists (
      select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()
    ))
  );

-- Create the initial Life OS structure atomically for each new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  imaginarium_id uuid := gen_random_uuid();
  aquascaping_id uuid := gen_random_uuid();
  mural_id uuid := gen_random_uuid();
begin
  insert into public.user_settings (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.projects (id, user_id, name, description, sort_order) values
    (imaginarium_id, new.id, 'OGs Imaginarium', 'Build the plan and bring the right people together.', 0),
    (aquascaping_id, new.id, 'Aquascaping', 'Create a calmer, healthier aquarium setup.', 1),
    (mural_id, new.id, 'Draw A Mural', 'Make steady creative progress.', 2);

  insert into public.tasks (user_id, title, task_type, area, project_id, sort_order, coros_metadata) values
    (new.id, 'Wake up by 6:30 am', 'daily', 'health', null, 0, null),
    (new.id, 'Do neck and shoulder physio', 'daily', 'health', null, 1, null),
    (new.id, 'Go to gym', 'daily', 'health', null, 2, null),
    (new.id, '5km daily walk', 'daily', 'health', null, 3, '{"provider":"coros","metric":"walking_distance_km","threshold":5}'),
    (new.id, '10,000 steps a day', 'daily', 'health', null, 4, '{"provider":"coros","metric":"steps","threshold":10000}'),
    (new.id, 'No milk tea + no sugar in tea', 'daily', 'health', null, 5, null),
    (new.id, 'GAIL gas pipeline', 'one_time', 'personal', null, 10, null),
    (new.id, 'Electricity name change', 'one_time', 'personal', null, 11, null),
    (new.id, 'Interview prep', 'one_time', 'work', null, 20, null),
    (new.id, 'Job hunt', 'one_time', 'work', null, 21, null),
    (new.id, 'Call Nithin', 'project_subtask', 'projects', imaginarium_id, 30, null),
    (new.id, 'Call Unni', 'project_subtask', 'projects', imaginarium_id, 31, null),
    (new.id, 'Setup the plan', 'project_subtask', 'projects', imaginarium_id, 32, null),
    (new.id, 'Lofi track', 'project_subtask', 'projects', aquascaping_id, 40, null),
    (new.id, 'Set new aquarium', 'project_subtask', 'projects', aquascaping_id, 41, null),
    (new.id, 'Set new shrimp tank', 'project_subtask', 'projects', aquascaping_id, 42, null),
    (new.id, 'Draw 1 hr daily', 'daily', 'projects', mural_id, 50, null);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Realtime powers the phone-to-Mac test without manual refresh.
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.daily_completions;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.weight_entries;
alter publication supabase_realtime add table public.focus_sessions;
