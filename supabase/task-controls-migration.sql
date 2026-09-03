-- Life OS task controls upgrade
-- Run once in Supabase > SQL Editor before publishing the matching frontend.

alter table public.projects
  add column if not exists completed_at timestamptz;

-- The task table already includes priority and due_date in the original Phase 2 schema.
-- These statements make the migration safe for older Life OS databases as well.
alter table public.tasks
  add column if not exists priority text not null default 'normal';

alter table public.tasks
  add column if not exists due_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_priority_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_priority_check check (priority in ('low', 'normal', 'high'));
  end if;
end $$;
