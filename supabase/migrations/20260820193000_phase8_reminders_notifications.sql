alter table public.study_plan_items
  add column if not exists created_at timestamptz not null default now();

alter table public.reminder_preferences
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

delete from public.reminder_preferences a
using public.reminder_preferences b
where a.student_id = b.student_id
  and a.ctid < b.ctid;

create unique index if not exists idx_reminder_preferences_student_unique
  on public.reminder_preferences(student_id);

alter table public.notifications
  add column if not exists student_id uuid references public.students(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_notifications_user_created_at
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_student_created_at
  on public.notifications(student_id, created_at desc)
  where student_id is not null;
