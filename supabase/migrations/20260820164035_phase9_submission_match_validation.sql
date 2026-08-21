alter table public.work_submissions
  add column if not exists validation_status text,
  add column if not exists validation_confidence text,
  add column if not exists validation_reason text,
  add column if not exists validation_payload jsonb not null default '{}'::jsonb,
  add column if not exists validation_provider text,
  add column if not exists validated_at timestamptz,
  add column if not exists validation_confirmed_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'work_submissions_validation_status_check'
  ) then
    alter table public.work_submissions drop constraint work_submissions_validation_status_check;
  end if;
end $$;

alter table public.work_submissions
  add constraint work_submissions_validation_status_check
  check (validation_status is null or validation_status in ('MATCH', 'PARTIAL_MATCH', 'MISMATCH', 'UNREADABLE'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'work_submissions_validation_confidence_check'
  ) then
    alter table public.work_submissions drop constraint work_submissions_validation_confidence_check;
  end if;
end $$;

alter table public.work_submissions
  add constraint work_submissions_validation_confidence_check
  check (validation_confidence is null or validation_confidence in ('high', 'medium', 'low'));

create index if not exists idx_work_submissions_validation_status
  on public.work_submissions(validation_status, submission_kind, created_at desc);
