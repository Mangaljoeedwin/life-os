-- Eisenhower Matrix task fields
-- Run once in Supabase > SQL Editor before using the matrix with your account.

alter table public.tasks
  add column if not exists is_urgent boolean,
  add column if not exists is_important boolean,
  add column if not exists scheduled_for date,
  add column if not exists delegated_to text;

comment on column public.tasks.is_urgent is 'Eisenhower Matrix urgency classification; null means not yet classified.';
comment on column public.tasks.is_important is 'Eisenhower Matrix importance classification; null means not yet classified.';
comment on column public.tasks.scheduled_for is 'Optional planned date for important, non-urgent tasks.';
comment on column public.tasks.delegated_to is 'Optional person or team a delegated task is waiting on.';
