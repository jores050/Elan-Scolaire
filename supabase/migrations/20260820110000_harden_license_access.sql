begin;

alter table public.license_keys
  add column if not exists license_duration_days integer;

update public.license_keys
set license_duration_days = 365
where license_duration_days is null;

alter table public.license_keys
  alter column license_duration_days set default 365;

alter table public.license_keys
  alter column license_duration_days set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'license_keys_status_check'
      and conrelid = 'public.license_keys'::regclass
  ) then
    alter table public.license_keys
      drop constraint license_keys_status_check;
  end if;
end $$;

alter table public.license_keys
  add constraint license_keys_status_check
  check (status in ('available', 'active', 'disabled', 'expired'));

update public.license_keys
set status = 'active'
where status = 'activated';

update public.license_keys
set activated_at = coalesce(activated_at, created_at, now())
where status = 'active'
  and activated_at is null;

-- Compatibilité: ne pas bloquer les licences déjà actives lors de l'introduction
-- de expires_at. Elles reçoivent 365 jours à compter de cette migration si aucune
-- date d'expiration n'existait encore.
update public.license_keys
set expires_at = now() + make_interval(days => license_duration_days)
where status = 'active'
  and expires_at is null;

update public.license_keys
set status = 'expired'
where status = 'active'
  and expires_at <= now();

create unique index if not exists idx_license_keys_order_reference_unique
  on public.license_keys(order_reference)
  where order_reference is not null;

create or replace function public.is_license_current(p_license_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.license_keys lk
    where lk.id = p_license_id
      and lk.status = 'active'
      and lk.expires_at is not null
      and lk.expires_at > now()
  );
$$;

create or replace function public.current_user_has_premium_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (
          p.active_license_id is not null
          and public.is_license_current(p.active_license_id)
        )
      )
  );
$$;

create or replace function public.enforce_student_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_license record;
  v_student_count integer;
begin
  if new.parent_user_id is null then
    raise exception 'parent_user_id_required' using errcode = '23502';
  end if;

  select lk.id, lk.max_students, lk.status, lk.expires_at
  into v_license
  from public.profiles p
  join public.license_keys lk on lk.id = p.active_license_id
  where p.id = new.parent_user_id;

  if v_license.id is null then
    raise exception 'active_license_required' using errcode = '42501';
  end if;

  if v_license.status <> 'active' or v_license.expires_at is null or v_license.expires_at <= now() then
    raise exception 'active_license_required' using errcode = '42501';
  end if;

  select count(*)
  into v_student_count
  from public.students s
  where s.parent_user_id = new.parent_user_id
    and s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_student_count >= v_license.max_students then
    raise exception 'max_students_reached' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_student_capacity on public.students;
create trigger trg_enforce_student_capacity
before insert or update of parent_user_id
on public.students
for each row
execute function public.enforce_student_capacity();

drop policy if exists "parents_insert_own_students" on public.students;
create policy "parents_insert_own_students"
on public.students
for insert
to authenticated
with check (
  parent_user_id = auth.uid()
  and public.current_user_has_premium_access()
);

drop policy if exists "premium_read_learning_programs" on public.learning_programs;
create policy "premium_read_learning_programs"
on public.learning_programs
for select
to authenticated
using (
  active = true
  and public.current_user_has_premium_access()
);

drop policy if exists "premium_read_learning_program_days" on public.learning_program_days;
create policy "premium_read_learning_program_days"
on public.learning_program_days
for select
to authenticated
using (
  active = true
  and public.current_user_has_premium_access()
);

drop policy if exists "premium_read_learning_program_items" on public.learning_program_items;
create policy "premium_read_learning_program_items"
on public.learning_program_items
for select
to authenticated
using (
  active = true
  and public.current_user_has_premium_access()
);

drop policy if exists "parents_manage_own_program_enrollments" on public.student_program_enrollments;
create policy "parents_manage_own_program_enrollments"
on public.student_program_enrollments
for all
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.parent_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.parent_user_id = auth.uid()
  )
  and public.current_user_has_premium_access()
);

drop policy if exists "authenticated_read_annual_programs" on public.annual_programs;
create policy "authenticated_read_annual_programs"
on public.annual_programs
for select
to authenticated
using (
  active = true
  and public.current_user_has_premium_access()
);

drop policy if exists "authenticated_read_published_annual_weeks" on public.annual_program_weeks;
create policy "authenticated_read_published_annual_weeks"
on public.annual_program_weeks
for select
to authenticated
using (
  published = true
  and content_ready = true
  and exists (
    select 1
    from public.annual_programs p
    where p.id = annual_program_id
      and p.active = true
  )
  and public.current_user_has_premium_access()
);

drop policy if exists "authenticated_read_published_annual_items" on public.annual_week_items;
create policy "authenticated_read_published_annual_items"
on public.annual_week_items
for select
to authenticated
using (
  published = true
  and exists (
    select 1
    from public.annual_program_weeks w
    join public.annual_programs p on p.id = w.annual_program_id
    where w.id = week_id
      and w.published = true
      and w.content_ready = true
      and p.active = true
  )
  and public.current_user_has_premium_access()
);

create or replace function public.start_pret_pour_la_3e_14_jours(p_student_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_program_id uuid;
  v_enrollment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.parent_user_id = auth.uid()
  ) then
    raise exception 'Student not owned by current user';
  end if;

  if not public.current_user_has_premium_access() then
    raise exception 'Active Elan Scolaire license required';
  end if;

  select id into v_program_id
  from public.learning_programs
  where slug = 'pret-pour-la-3e-14-jours'
    and active = true
  limit 1;

  if v_program_id is null then
    raise exception 'Program not found';
  end if;

  insert into public.student_program_enrollments (
    student_id, program_id, status, started_at
  )
  values (
    p_student_id, v_program_id, 'active', now()
  )
  on conflict (student_id, program_id) do update
    set status = case
      when public.student_program_enrollments.status = 'completed'
        then public.student_program_enrollments.status
      else 'active'
    end,
    updated_at = now()
  returning id into v_enrollment_id;

  insert into public.student_program_day_progress (
    enrollment_id, program_day_id, status
  )
  select
    v_enrollment_id,
    d.id,
    'not_started'
  from public.learning_program_days d
  where d.program_id = v_program_id
    and d.active = true
  on conflict (enrollment_id, program_day_id) do nothing;

  insert into public.student_program_item_progress (
    enrollment_id, program_item_id, status
  )
  select
    v_enrollment_id,
    i.id,
    'not_started'
  from public.learning_program_items i
  join public.learning_program_days d on d.id = i.program_day_id
  where d.program_id = v_program_id
    and d.active = true
    and i.active = true
    and i.item_type <> 'guided_example'
  on conflict (enrollment_id, program_item_id) do nothing;

  return v_enrollment_id;
end;
$$;

commit;
