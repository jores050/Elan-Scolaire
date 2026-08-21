alter table public.work_submissions
  add column if not exists processing_status text not null default 'completed',
  add column if not exists processing_error text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'work_submissions_processing_status_check'
      and conrelid = 'public.work_submissions'::regclass
  ) then
    alter table public.work_submissions drop constraint work_submissions_processing_status_check;
  end if;
end $$;

alter table public.work_submissions
  add constraint work_submissions_processing_status_check
  check (processing_status in ('pending', 'processing', 'completed', 'failed'));

update public.work_submissions ws
set
  processing_status = case
    when ws.submission_kind = 'diagnostic'
      and exists (
        select 1
        from public.ai_analyses a
        where a.submission_id = ws.id
      ) then 'completed'
    when ws.submission_kind = 'diagnostic' then 'failed'
    else 'completed'
  end,
  processing_completed_at = case
    when exists (
      select 1
      from public.ai_analyses a
      where a.submission_id = ws.id
    ) then coalesce(ws.processing_completed_at, now())
    else ws.processing_completed_at
  end
where ws.processing_status is distinct from case
  when ws.submission_kind = 'diagnostic'
    and exists (
      select 1
      from public.ai_analyses a
      where a.submission_id = ws.id
    ) then 'completed'
  when ws.submission_kind = 'diagnostic' then 'failed'
  else 'completed'
end;

create index if not exists idx_work_submissions_processing_status
  on public.work_submissions(processing_status, submission_kind, created_at desc);

alter table public.ai_analyses
  add column if not exists summary_ai text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'student_program_enrollments_status_check'
      and conrelid = 'public.student_program_enrollments'::regclass
  ) then
    alter table public.student_program_enrollments drop constraint student_program_enrollments_status_check;
  end if;
end $$;

alter table public.student_program_enrollments
  add column if not exists plan_snapshot jsonb not null default '{}'::jsonb;

alter table public.student_program_enrollments
  add constraint student_program_enrollments_status_check
  check (status in ('planned', 'active', 'completed', 'paused'));

alter table public.student_program_day_progress
  add column if not exists session_index integer,
  add column if not exists snapshot_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_student_program_day_progress_session
  on public.student_program_day_progress(enrollment_id, session_index);
