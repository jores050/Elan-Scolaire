-- ============================================================
-- ELAN SCOLAIRE — AUDIT SECURITY DEFINER
-- LECTURE SEULE : ce script ne modifie rien.
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- 1) Toutes les fonctions utilisateur et leur statut SECURITY DEFINER
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proacl as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema')
order by p.prosecdef desc, n.nspname, p.proname;

-- 2) Fonctions SECURITY DEFINER uniquement + droits EXECUTE des rôles Supabase
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef = true
  and n.nspname not in ('pg_catalog', 'information_schema')
order by n.nspname, p.proname;

-- 3) Grants explicites sur les routines
select
  routine_schema,
  routine_name,
  specific_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema not in ('pg_catalog', 'information_schema')
order by routine_schema, routine_name, grantee;

-- 4) Recherche ciblée de rls_auto_enable (si elle existe)
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proacl as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'rls_auto_enable';

-- 5) Schéma réel de la table students : IMPORTANT pour corriger le SQL du guide
select
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'students'
order by ordinal_position;

-- 6) Policies RLS actuelles de students : permet d'identifier le vrai lien parent -> élève
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
  and tablename = 'students'
order by policyname;

-- 7) Colonnes réelles de profiles et work_submissions, également utilisées par le script
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'work_submissions')
order by table_name, ordinal_position;
