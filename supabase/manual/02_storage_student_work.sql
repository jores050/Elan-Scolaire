-- ELAN SCOLAIRE
-- Configuration manuelle Storage
-- Script NON DESTRUCTIF pour exécution dans Supabase SQL Editor

begin;

-- =========================================================
-- 1) Créer le bucket privé s'il n'existe pas encore
-- =========================================================
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
select
  'student-work',
  'student-work',
  false,
  4194304,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
where not exists (
  select 1
  from storage.buckets
  where id = 'student-work'
);

-- =========================================================
-- 2) S'assurer qu'il reste privé et limité aux bons formats
-- =========================================================
update storage.buckets
set
  public = false,
  file_size_limit = 4194304,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
where id = 'student-work';

-- =========================================================
-- 3) Nettoyer uniquement les policies ciblées de ce bucket
-- =========================================================
drop policy if exists "student_work_insert_own_prefix" on storage.objects;
drop policy if exists "student_work_select_own_prefix" on storage.objects;
drop policy if exists "student_work_delete_own_prefix" on storage.objects;

-- =========================================================
-- 4) Policies bucket student-work
-- Structure attendue : {auth.uid()}/{studentId}/{submissionId}/{filename}
-- =========================================================

create policy "student_work_insert_own_prefix"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-work'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "student_work_select_own_prefix"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-work'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "student_work_delete_own_prefix"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-work'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;

-- =========================================================
-- 5) Vérification rapide après exécution
-- =========================================================
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage'
  and c.relname = 'objects';

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'student-work';

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'student_work_insert_own_prefix',
    'student_work_select_own_prefix',
    'student_work_delete_own_prefix'
  )
order by policyname;
