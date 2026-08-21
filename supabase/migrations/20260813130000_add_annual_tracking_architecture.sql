-- Architecture additive pour le suivi annuel de 3e.
-- Aucun contenu pédagogique hebdomadaire n'est créé par cette migration.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.students
  add column if not exists active_phase text not null default 'preparation';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'students_active_phase_check'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_active_phase_check
      check (active_phase in ('preparation', 'annual_tracking'));
  end if;
end $$;

create table if not exists public.annual_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  grade text not null default '3e',
  country text not null default 'Bénin',
  school_year text,
  guide_reference text,
  content_ready boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.annual_program_weeks (
  id uuid primary key default gen_random_uuid(),
  annual_program_id uuid not null references public.annual_programs(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  school_term text,
  learning_area_id uuid references public.learning_areas(id) on delete set null,
  title text not null,
  objective text,
  topic_id uuid references public.topics(id) on delete set null,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  guide_reference text,
  page_reference text,
  instructions text,
  published boolean not null default false,
  content_ready boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (annual_program_id, week_number)
);

create table if not exists public.annual_week_items (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.annual_program_weeks(id) on delete cascade,
  item_type text not null check (item_type in ('lesson', 'example', 'exercise', 'revision', 'weekly_test')),
  title text not null,
  instructions text,
  exercise_id uuid references public.exercises(id) on delete set null,
  guide_reference text,
  page_reference text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, sort_order)
);

create table if not exists public.student_annual_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  annual_program_id uuid not null references public.annual_programs(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, annual_program_id)
);

create table if not exists public.student_week_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.student_annual_enrollments(id) on delete cascade,
  week_id uuid not null references public.annual_program_weeks(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'needs_review')),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, week_id)
);

create table if not exists public.student_week_item_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.student_annual_enrollments(id) on delete cascade,
  week_item_id uuid not null references public.annual_week_items(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'needs_review')),
  score numeric check (score is null or (score >= 0 and score <= 20)),
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, week_item_id)
);

alter table public.work_submissions
  add column if not exists annual_week_id uuid,
  add column if not exists annual_week_item_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'work_submissions_annual_week_id_fkey') then
    alter table public.work_submissions add constraint work_submissions_annual_week_id_fkey
      foreign key (annual_week_id) references public.annual_program_weeks(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'work_submissions_annual_week_item_id_fkey') then
    alter table public.work_submissions add constraint work_submissions_annual_week_item_id_fkey
      foreign key (annual_week_item_id) references public.annual_week_items(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'work_submissions_single_learning_phase_check') then
    alter table public.work_submissions add constraint work_submissions_single_learning_phase_check
      check (
        not (
          (program_day_id is not null or program_item_id is not null)
          and (annual_week_id is not null or annual_week_item_id is not null)
        )
      );
  end if;
end $$;

create index if not exists idx_annual_weeks_program on public.annual_program_weeks(annual_program_id, week_number);
create index if not exists idx_annual_items_week on public.annual_week_items(week_id, sort_order);
create index if not exists idx_annual_enrollments_student on public.student_annual_enrollments(student_id);
create index if not exists idx_week_progress_enrollment on public.student_week_progress(enrollment_id);
create index if not exists idx_week_item_progress_enrollment on public.student_week_item_progress(enrollment_id);
create index if not exists idx_work_submissions_annual_week on public.work_submissions(annual_week_id);

insert into public.annual_programs (slug, title, grade, country, content_ready, active)
values ('suivi-annuel-3e', 'Suivi semaine par semaine — Maths 3e', '3e', 'Bénin', false, true)
on conflict (slug) do update set
  title = excluded.title,
  active = true,
  updated_at = now();

alter table public.annual_programs enable row level security;
alter table public.annual_program_weeks enable row level security;
alter table public.annual_week_items enable row level security;
alter table public.student_annual_enrollments enable row level security;
alter table public.student_week_progress enable row level security;
alter table public.student_week_item_progress enable row level security;

drop policy if exists "authenticated_read_annual_programs" on public.annual_programs;
create policy "authenticated_read_annual_programs" on public.annual_programs
for select to authenticated using (active = true);

drop policy if exists "authenticated_read_published_annual_weeks" on public.annual_program_weeks;
create policy "authenticated_read_published_annual_weeks" on public.annual_program_weeks
for select to authenticated using (
  published = true and content_ready = true
  and exists (select 1 from public.annual_programs p where p.id = annual_program_id and p.active = true)
);

drop policy if exists "authenticated_read_published_annual_items" on public.annual_week_items;
create policy "authenticated_read_published_annual_items" on public.annual_week_items
for select to authenticated using (
  published = true
  and exists (
    select 1 from public.annual_program_weeks w
    join public.annual_programs p on p.id = w.annual_program_id
    where w.id = week_id and w.published = true and w.content_ready = true and p.active = true
  )
);

drop policy if exists "parents_view_own_annual_enrollment" on public.student_annual_enrollments;
create policy "parents_view_own_annual_enrollment" on public.student_annual_enrollments
for select to authenticated using (
  exists (select 1 from public.students s where s.id = student_id and s.parent_user_id = (select auth.uid()))
);
drop policy if exists "parents_insert_own_annual_enrollment" on public.student_annual_enrollments;
create policy "parents_insert_own_annual_enrollment" on public.student_annual_enrollments
for insert to authenticated with check (
  exists (select 1 from public.students s where s.id = student_id and s.parent_user_id = (select auth.uid()))
);
drop policy if exists "parents_update_own_annual_enrollment" on public.student_annual_enrollments;
create policy "parents_update_own_annual_enrollment" on public.student_annual_enrollments
for update to authenticated
using (exists (select 1 from public.students s where s.id = student_id and s.parent_user_id = (select auth.uid())))
with check (exists (select 1 from public.students s where s.id = student_id and s.parent_user_id = (select auth.uid())));

drop policy if exists "parents_view_own_week_progress" on public.student_week_progress;
create policy "parents_view_own_week_progress" on public.student_week_progress
for select to authenticated using (
  exists (
    select 1 from public.student_annual_enrollments e
    join public.students s on s.id = e.student_id
    where e.id = enrollment_id and s.parent_user_id = (select auth.uid())
  )
);
drop policy if exists "parents_insert_own_week_progress" on public.student_week_progress;
create policy "parents_insert_own_week_progress" on public.student_week_progress
for insert to authenticated with check (
  exists (
    select 1 from public.student_annual_enrollments e
    join public.students s on s.id = e.student_id
    where e.id = enrollment_id and s.parent_user_id = (select auth.uid())
  )
);
drop policy if exists "parents_update_own_week_progress" on public.student_week_progress;
create policy "parents_update_own_week_progress" on public.student_week_progress
for update to authenticated
using (exists (select 1 from public.student_annual_enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.parent_user_id=(select auth.uid())))
with check (exists (select 1 from public.student_annual_enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.parent_user_id=(select auth.uid())));

drop policy if exists "parents_view_own_week_item_progress" on public.student_week_item_progress;
create policy "parents_view_own_week_item_progress" on public.student_week_item_progress
for select to authenticated using (
  exists (select 1 from public.student_annual_enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.parent_user_id=(select auth.uid()))
);
drop policy if exists "parents_insert_own_week_item_progress" on public.student_week_item_progress;
create policy "parents_insert_own_week_item_progress" on public.student_week_item_progress
for insert to authenticated with check (
  exists (select 1 from public.student_annual_enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.parent_user_id=(select auth.uid()))
);
drop policy if exists "parents_update_own_week_item_progress" on public.student_week_item_progress;
create policy "parents_update_own_week_item_progress" on public.student_week_item_progress
for update to authenticated
using (exists (select 1 from public.student_annual_enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.parent_user_id=(select auth.uid())))
with check (exists (select 1 from public.student_annual_enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.parent_user_id=(select auth.uid())));

grant select on public.annual_programs, public.annual_program_weeks, public.annual_week_items to authenticated;
grant select, insert, update on public.student_annual_enrollments, public.student_week_progress, public.student_week_item_progress to authenticated;
grant all on public.annual_programs, public.annual_program_weeks, public.annual_week_items,
  public.student_annual_enrollments, public.student_week_progress, public.student_week_item_progress to service_role;

create or replace function public.start_annual_tracking(p_student_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_program_id uuid;
  v_enrollment_id uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.parent_user_id = (select auth.uid())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id into v_program_id
  from public.annual_programs
  where slug = 'suivi-annuel-3e' and active = true
  limit 1;

  if v_program_id is null then
    raise exception 'annual program unavailable' using errcode = 'P0002';
  end if;

  insert into public.student_annual_enrollments (student_id, annual_program_id)
  values (p_student_id, v_program_id)
  on conflict (student_id, annual_program_id) do update
    set updated_at = now()
  returning id into v_enrollment_id;

  update public.students set active_phase = 'annual_tracking' where id = p_student_id;
  return v_enrollment_id;
end;
$$;

revoke all on function public.start_annual_tracking(uuid) from public, anon;
grant execute on function public.start_annual_tracking(uuid) to authenticated, service_role;

create or replace function private.transition_day14_to_annual()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_student_id uuid;
  v_annual_program_id uuid;
begin
  if new.status <> 'completed' then return new; end if;

  select e.student_id into v_student_id
  from public.student_program_enrollments e
  join public.learning_program_days d on d.id = new.program_day_id
  join public.learning_programs p on p.id = d.program_id
  where e.id = new.enrollment_id
    and d.day_number = 14
    and p.slug = 'pret-pour-la-3e-14-jours';

  if v_student_id is null then return new; end if;

  select id into v_annual_program_id
  from public.annual_programs
  where slug = 'suivi-annuel-3e' and active = true
  limit 1;

  if v_annual_program_id is null then return new; end if;

  insert into public.student_annual_enrollments (student_id, annual_program_id)
  values (v_student_id, v_annual_program_id)
  on conflict (student_id, annual_program_id) do update set updated_at = now();

  update public.students set active_phase = 'annual_tracking' where id = v_student_id;
  return new;
end;
$$;

revoke all on function private.transition_day14_to_annual() from public, anon, authenticated;

drop trigger if exists transition_day14_to_annual on public.student_program_day_progress;
create trigger transition_day14_to_annual
after insert or update of status on public.student_program_day_progress
for each row execute function private.transition_day14_to_annual();

