-- ELAN SCOLAIRE
-- Audit manuel post-migration RLS
-- Ce script NE MODIFIE RIEN.
-- Il sert uniquement à vérifier l'état réel de sécurité dans Supabase.

-- =========================================================
-- 1) RLS activée ou non sur les tables visées
-- =========================================================
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles',
    'students',
    'student_topic_progress',
    'work_submissions',
    'ai_analyses',
    'study_plans',
    'study_plan_items',
    'reminder_preferences',
    'notifications',
    'license_activations',
    'license_keys',
    'subjects',
    'learning_areas',
    'topics',
    'exercises',
    'admin_audit_logs'
  )
order by c.relname;

-- =========================================================
-- 2) Policies présentes sur les tables visées
-- =========================================================
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'students',
    'student_topic_progress',
    'work_submissions',
    'ai_analyses',
    'study_plans',
    'study_plan_items',
    'reminder_preferences',
    'notifications',
    'license_activations',
    'license_keys',
    'subjects',
    'learning_areas',
    'topics',
    'exercises',
    'admin_audit_logs'
  )
order by tablename, policyname;

-- =========================================================
-- 3) Focus policies par table critique
-- =========================================================
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'license_keys'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'students'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'student_topic_progress'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'work_submissions'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'ai_analyses'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'study_plans'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'study_plan_items'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'reminder_preferences'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'notifications'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'license_activations'
order by policyname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('subjects', 'learning_areas', 'topics', 'exercises')
order by tablename, policyname;

-- =========================================================
-- 4) Fonctions SECURITY DEFINER dans public
-- =========================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;

-- =========================================================
-- 5) Droits EXECUTE sur les fonctions SECURITY DEFINER
-- =========================================================
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  )
order by routine_name, grantee, privilege_type;

-- =========================================================
-- 6) Vérification ciblée de rls_auto_enable
-- =========================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'rls_auto_enable';

select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'rls_auto_enable'
order by grantee, privilege_type;

-- =========================================================
-- 7) Permissions directes de table pour anon/authenticated
-- =========================================================
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'profiles',
    'students',
    'student_topic_progress',
    'work_submissions',
    'ai_analyses',
    'study_plans',
    'study_plan_items',
    'reminder_preferences',
    'notifications',
    'license_activations',
    'license_keys',
    'subjects',
    'learning_areas',
    'topics',
    'exercises',
    'admin_audit_logs'
  )
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- =========================================================
-- 8) Synthèse rapide lisible
-- =========================================================
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles',
    'students',
    'student_topic_progress',
    'work_submissions',
    'ai_analyses',
    'study_plans',
    'study_plan_items',
    'reminder_preferences',
    'notifications',
    'license_activations',
    'license_keys',
    'subjects',
    'learning_areas',
    'topics',
    'exercises',
    'admin_audit_logs'
  )
group by c.relname, c.relrowsecurity
order by c.relname;
