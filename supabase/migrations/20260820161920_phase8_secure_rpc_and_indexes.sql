revoke execute on function public.current_user_has_premium_access() from public, anon, authenticated;
grant execute on function public.current_user_has_premium_access() to service_role;

revoke execute on function public.enforce_student_capacity() from public, anon, authenticated;
grant execute on function public.enforce_student_capacity() to service_role;

revoke execute on function public.is_license_current(uuid) from public, anon, authenticated;
grant execute on function public.is_license_current(uuid) to service_role;

drop policy if exists "admins_manage_license_keys" on public.license_keys;
create policy "admins_manage_license_keys"
on public.license_keys
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

drop policy if exists "admins_read_audit_logs" on public.admin_audit_logs;
create policy "admins_read_audit_logs"
on public.admin_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

create index if not exists idx_ai_analyses_submission on public.ai_analyses(submission_id);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_reminder_preferences_student on public.reminder_preferences(student_id);
create index if not exists idx_study_plans_student on public.study_plans(student_id);
create index if not exists idx_work_submissions_student on public.work_submissions(student_id);
