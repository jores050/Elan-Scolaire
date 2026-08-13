set check_function_bodies = off;

create or replace function public.is_current_student_owner(target_student_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = target_student_id
      and s.parent_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_current_study_plan_owner(target_study_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.study_plans sp
    join public.students s on s.id = sp.student_id
    where sp.id = target_study_plan_id
      and s.parent_user_id = (select auth.uid())
  );
$$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.student_topic_progress enable row level security;
alter table public.work_submissions enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_items enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.license_activations enable row level security;
alter table public.license_keys enable row level security;
alter table public.subjects enable row level security;
alter table public.learning_areas enable row level security;
alter table public.topics enable row level security;
alter table public.exercises enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "parents_view_own_profile" on public.profiles;
drop policy if exists "parents_update_own_profile" on public.profiles;
create policy "parents_view_own_profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);
create policy "parents_update_own_profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "parents_view_own_students" on public.students;
drop policy if exists "parents_manage_own_students" on public.students;
drop policy if exists "parents_insert_own_students" on public.students;
drop policy if exists "parents_update_own_students" on public.students;
drop policy if exists "parents_delete_own_students" on public.students;
create policy "parents_view_own_students"
on public.students
for select
to authenticated
using (parent_user_id = (select auth.uid()));
create policy "parents_insert_own_students"
on public.students
for insert
to authenticated
with check (parent_user_id = (select auth.uid()));
create policy "parents_update_own_students"
on public.students
for update
to authenticated
using (parent_user_id = (select auth.uid()))
with check (parent_user_id = (select auth.uid()));
create policy "parents_delete_own_students"
on public.students
for delete
to authenticated
using (parent_user_id = (select auth.uid()));

drop policy if exists "parents_view_own_progress" on public.student_topic_progress;
drop policy if exists "parents_insert_own_progress" on public.student_topic_progress;
drop policy if exists "parents_update_own_progress" on public.student_topic_progress;
drop policy if exists "parents_delete_own_progress" on public.student_topic_progress;
create policy "parents_view_own_progress"
on public.student_topic_progress
for select
to authenticated
using (public.is_current_student_owner(student_id));
create policy "parents_insert_own_progress"
on public.student_topic_progress
for insert
to authenticated
with check (public.is_current_student_owner(student_id));
create policy "parents_update_own_progress"
on public.student_topic_progress
for update
to authenticated
using (public.is_current_student_owner(student_id))
with check (public.is_current_student_owner(student_id));
create policy "parents_delete_own_progress"
on public.student_topic_progress
for delete
to authenticated
using (public.is_current_student_owner(student_id));

drop policy if exists "parents_view_own_submissions" on public.work_submissions;
drop policy if exists "parents_insert_own_submissions" on public.work_submissions;
drop policy if exists "parents_update_own_submissions" on public.work_submissions;
drop policy if exists "parents_delete_own_submissions" on public.work_submissions;
create policy "parents_view_own_submissions"
on public.work_submissions
for select
to authenticated
using (public.is_current_student_owner(student_id));
create policy "parents_insert_own_submissions"
on public.work_submissions
for insert
to authenticated
with check (public.is_current_student_owner(student_id));
create policy "parents_update_own_submissions"
on public.work_submissions
for update
to authenticated
using (public.is_current_student_owner(student_id))
with check (public.is_current_student_owner(student_id));
create policy "parents_delete_own_submissions"
on public.work_submissions
for delete
to authenticated
using (public.is_current_student_owner(student_id));

drop policy if exists "parents_view_own_analyses" on public.ai_analyses;
create policy "parents_view_own_analyses"
on public.ai_analyses
for select
to authenticated
using (
  exists (
    select 1
    from public.work_submissions ws
    where ws.id = submission_id
      and public.is_current_student_owner(ws.student_id)
  )
);

drop policy if exists "parents_view_own_study_plans" on public.study_plans;
drop policy if exists "parents_insert_own_study_plans" on public.study_plans;
drop policy if exists "parents_update_own_study_plans" on public.study_plans;
drop policy if exists "parents_delete_own_study_plans" on public.study_plans;
create policy "parents_view_own_study_plans"
on public.study_plans
for select
to authenticated
using (public.is_current_student_owner(student_id));
create policy "parents_insert_own_study_plans"
on public.study_plans
for insert
to authenticated
with check (public.is_current_student_owner(student_id));
create policy "parents_update_own_study_plans"
on public.study_plans
for update
to authenticated
using (public.is_current_student_owner(student_id))
with check (public.is_current_student_owner(student_id));
create policy "parents_delete_own_study_plans"
on public.study_plans
for delete
to authenticated
using (public.is_current_student_owner(student_id));

drop policy if exists "parents_view_own_study_plan_items" on public.study_plan_items;
drop policy if exists "parents_insert_own_study_plan_items" on public.study_plan_items;
drop policy if exists "parents_update_own_study_plan_items" on public.study_plan_items;
drop policy if exists "parents_delete_own_study_plan_items" on public.study_plan_items;
create policy "parents_view_own_study_plan_items"
on public.study_plan_items
for select
to authenticated
using (public.is_current_study_plan_owner(study_plan_id));
create policy "parents_insert_own_study_plan_items"
on public.study_plan_items
for insert
to authenticated
with check (public.is_current_study_plan_owner(study_plan_id));
create policy "parents_update_own_study_plan_items"
on public.study_plan_items
for update
to authenticated
using (public.is_current_study_plan_owner(study_plan_id))
with check (public.is_current_study_plan_owner(study_plan_id));
create policy "parents_delete_own_study_plan_items"
on public.study_plan_items
for delete
to authenticated
using (public.is_current_study_plan_owner(study_plan_id));

drop policy if exists "parents_view_own_reminder_preferences" on public.reminder_preferences;
drop policy if exists "parents_insert_own_reminder_preferences" on public.reminder_preferences;
drop policy if exists "parents_update_own_reminder_preferences" on public.reminder_preferences;
drop policy if exists "parents_delete_own_reminder_preferences" on public.reminder_preferences;
create policy "parents_view_own_reminder_preferences"
on public.reminder_preferences
for select
to authenticated
using (public.is_current_student_owner(student_id));
create policy "parents_insert_own_reminder_preferences"
on public.reminder_preferences
for insert
to authenticated
with check (public.is_current_student_owner(student_id));
create policy "parents_update_own_reminder_preferences"
on public.reminder_preferences
for update
to authenticated
using (public.is_current_student_owner(student_id))
with check (public.is_current_student_owner(student_id));
create policy "parents_delete_own_reminder_preferences"
on public.reminder_preferences
for delete
to authenticated
using (public.is_current_student_owner(student_id));

drop policy if exists "parents_view_own_notifications" on public.notifications;
drop policy if exists "parents_update_own_notifications" on public.notifications;
create policy "parents_view_own_notifications"
on public.notifications
for select
to authenticated
using (user_id = (select auth.uid()));
create policy "parents_update_own_notifications"
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "parents_view_own_license_activations" on public.license_activations;
create policy "parents_view_own_license_activations"
on public.license_activations
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "authenticated_read_subjects" on public.subjects;
drop policy if exists "authenticated_read_learning_areas" on public.learning_areas;
drop policy if exists "authenticated_read_topics" on public.topics;
drop policy if exists "authenticated_read_exercises" on public.exercises;
create policy "authenticated_read_subjects"
on public.subjects
for select
to authenticated
using (true);
create policy "authenticated_read_learning_areas"
on public.learning_areas
for select
to authenticated
using (true);
create policy "authenticated_read_topics"
on public.topics
for select
to authenticated
using (true);
create policy "authenticated_read_exercises"
on public.exercises
for select
to authenticated
using (true);

do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname = 'rls_auto_enable'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end $$;
