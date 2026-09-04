-- Life OS shared Focus timer upgrade
-- Run this entire file once in Supabase > SQL Editor before publishing the matching frontend.

alter type public.focus_status add value if not exists 'running';
alter type public.focus_status add value if not exists 'paused';
alter type public.focus_status add value if not exists 'awaiting_outcome';

alter table public.user_settings
  add column if not exists focus_music_url text;

alter table public.focus_sessions
  add column if not exists phase text not null default 'work';

alter table public.focus_sessions
  add column if not exists phase_started_at timestamptz;

alter table public.focus_sessions
  add column if not exists phase_ends_at timestamptz;

alter table public.focus_sessions
  add column if not exists paused_seconds integer;

alter table public.focus_sessions
  add column if not exists music_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'focus_sessions_phase_check'
      and conrelid = 'public.focus_sessions'::regclass
  ) then
    alter table public.focus_sessions
      add constraint focus_sessions_phase_check check (phase in ('work', 'break'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'focus_sessions_paused_seconds_check'
      and conrelid = 'public.focus_sessions'::regclass
  ) then
    alter table public.focus_sessions
      add constraint focus_sessions_paused_seconds_check check (paused_seconds is null or paused_seconds >= 0);
  end if;
end $$;

create index if not exists focus_user_active_idx
  on public.focus_sessions (user_id, status, started_at desc);
