-- Life OS / COROS integration
-- Run once in Supabase > SQL Editor after the original schema.sql.

create table if not exists public.coros_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  steps integer check (steps is null or steps >= 0),
  calories numeric(10,2) check (calories is null or calories >= 0),
  exercise_minutes integer check (exercise_minutes is null or exercise_minutes >= 0),
  sleep_duration_minutes integer check (sleep_duration_minutes is null or sleep_duration_minutes >= 0),
  sleep_score numeric(5,2) check (sleep_score is null or sleep_score between 0 and 100),
  sleep_status text not null default 'not_checked'
    check (sleep_status in ('complete', 'partial', 'missing', 'not_synced', 'not_checked')),
  sync_status text not null default 'partial'
    check (sync_status in ('complete', 'partial', 'missing', 'error')),
  latest_run_type text not null default 'manual'
    check (latest_run_type in ('morning', 'night', 'manual', 'reconciliation')),
  morning_synced_at timestamptz,
  night_synced_at timestamptz,
  last_synced_at timestamptz not null default now(),
  raw_coros_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, metric_date)
);

create table if not exists public.coros_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coros_activity_id text not null,
  activity_date date not null,
  activity_type text not null,
  started_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  distance_km numeric(10,3) check (distance_km is null or distance_km >= 0),
  jump_count integer check (jump_count is null or jump_count >= 0),
  calories numeric(10,2) check (calories is null or calories >= 0),
  raw_coros_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, coros_activity_id)
);

alter table public.daily_completions
  add column if not exists actual_value numeric,
  add column if not exists actual_unit text,
  add column if not exists verified_at timestamptz;

create index if not exists coros_daily_user_date_idx
  on public.coros_daily_metrics (user_id, metric_date desc);
create index if not exists coros_activity_user_date_idx
  on public.coros_activities (user_id, activity_date desc, activity_type);

drop trigger if exists coros_daily_metrics_updated on public.coros_daily_metrics;
create trigger coros_daily_metrics_updated
  before update on public.coros_daily_metrics
  for each row execute function public.set_updated_at();

drop trigger if exists coros_activities_updated on public.coros_activities;
create trigger coros_activities_updated
  before update on public.coros_activities
  for each row execute function public.set_updated_at();

alter table public.coros_daily_metrics enable row level security;
alter table public.coros_activities enable row level security;

drop policy if exists "Read own COROS daily metrics" on public.coros_daily_metrics;
create policy "Read own COROS daily metrics"
  on public.coros_daily_metrics for select
  using (auth.uid() = user_id);

drop policy if exists "Read own COROS activities" on public.coros_activities;
create policy "Read own COROS activities"
  on public.coros_activities for select
  using (auth.uid() = user_id);

-- Refine the two existing COROS rules for every Life OS account.
update public.tasks
set coros_metadata = '{"provider":"coros","rule":"single_activity","metric":"distance_km","activity_types":["walk","run"],"operator":"gte","threshold":5,"unit":"km"}'::jsonb
where task_type = 'daily' and lower(title) = '5km daily walk';

update public.tasks
set coros_metadata = '{"provider":"coros","rule":"daily_total","metric":"steps","operator":"gte","threshold":10000,"unit":"steps"}'::jsonb
where task_type = 'daily' and lower(title) = '10,000 steps a day';

-- Add the two newly confirmed automated commitments to existing accounts.
insert into public.tasks (user_id, title, task_type, area, sort_order, coros_metadata)
select s.user_id, '1000 skips a day', 'daily', 'health', 5,
  '{"provider":"coros","rule":"single_activity","metric":"jump_count","activity_types":["jump rope"],"operator":"gte","threshold":1000,"unit":"jumps"}'::jsonb
from public.user_settings s
where not exists (
  select 1 from public.tasks t
  where t.user_id = s.user_id and t.task_type = 'daily' and lower(t.title) = '1000 skips a day'
);

insert into public.tasks (user_id, title, task_type, area, sort_order, coros_metadata)
select s.user_id, 'Sleep Duration >7hrs 30mins', 'daily', 'health', 6,
  '{"provider":"coros","rule":"daily_total","metric":"sleep_duration_minutes","operator":"gt","threshold":450,"unit":"minutes"}'::jsonb
from public.user_settings s
where not exists (
  select 1 from public.tasks t
  where t.user_id = s.user_id and t.task_type = 'daily' and lower(t.title) = lower('Sleep Duration >7hrs 30mins')
);

-- Move the remaining health tasks after the two new commitments.
update public.tasks set sort_order = 7
where task_type = 'daily' and lower(title) = 'no milk tea + no sugar in tea';

-- Keep browser clients read-only for COROS facts. The Edge Function writes with
-- the service role; signed-in users continue to read only their own rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coros_daily_metrics'
  ) then
    alter publication supabase_realtime add table public.coros_daily_metrics;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coros_activities'
  ) then
    alter publication supabase_realtime add table public.coros_activities;
  end if;
end $$;

-- Future accounts receive the same four COROS-linked tasks.
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
    (new.id, '5km daily walk', 'daily', 'health', null, 3, '{"provider":"coros","rule":"single_activity","metric":"distance_km","activity_types":["walk","run"],"operator":"gte","threshold":5,"unit":"km"}'),
    (new.id, '10,000 steps a day', 'daily', 'health', null, 4, '{"provider":"coros","rule":"daily_total","metric":"steps","operator":"gte","threshold":10000,"unit":"steps"}'),
    (new.id, '1000 skips a day', 'daily', 'health', null, 5, '{"provider":"coros","rule":"single_activity","metric":"jump_count","activity_types":["jump rope"],"operator":"gte","threshold":1000,"unit":"jumps"}'),
    (new.id, 'Sleep Duration >7hrs 30mins', 'daily', 'health', null, 6, '{"provider":"coros","rule":"daily_total","metric":"sleep_duration_minutes","operator":"gt","threshold":450,"unit":"minutes"}'),
    (new.id, 'No milk tea + no sugar in tea', 'daily', 'health', null, 7, null),
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
