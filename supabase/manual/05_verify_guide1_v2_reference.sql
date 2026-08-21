-- Vérifications SQL après exécution de :
-- 1) supabase/migrations/20260821100000_create_guide1_reference_tables.sql
-- 2) supabase/manual/04_seed_guide1_v2_reference.sql

-- 1. Nombre de jours Guide 1 V2
select count(*) as day_rows
from public.guide_day_reference
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2';

-- 2. Jours J1 -> J14
select
  day_number,
  day_reference,
  day_title,
  document_type,
  page_start,
  page_end
from public.guide_day_reference
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
order by day_number;

-- 3. Nombre d'items diagnostic
select count(*) as diagnostic_rows
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
  and document_type = 'DIAGNOSTIC';

-- 4. Doublons reference_id
select
  reference_id,
  count(*) as duplicate_count
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
group by reference_id
having count(*) > 1;

-- 5. Nombre exact d'items par bucket
select
  coalesce(cast(day_number as text), 'DIAGNOSTIC') as bucket,
  count(*) as item_count
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
group by coalesce(cast(day_number as text), 'DIAGNOSTIC')
order by coalesce(cast(day_number as text), 'DIAGNOSTIC');

-- 6. Niveaux présents pour J1 -> J13
select
  day_number,
  level_code,
  count(*) as item_count
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
  and document_type = 'PROGRAM_DAY'
  and day_number between 1 and 13
  and level_code is not null
group by day_number, level_code
order by day_number, level_code;

-- 7. Mini-tests présents pour J1 -> J13
select
  day_number,
  reference_id
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
  and document_type = 'PROGRAM_DAY'
  and day_number between 1 and 13
  and section_code = 'MINI_TEST'
order by day_number, reference_id;

-- 8. Questions finales J14
select
  reference_id,
  section_code,
  item_order,
  prompt_text
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
  and document_type = 'FINAL_TEST'
order by reference_id;

-- 9. Pages par document / jour
select
  document_type,
  day_number,
  min(page_reference) as min_page_reference,
  max(page_reference) as max_page_reference,
  count(*) as item_count
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
group by document_type, day_number
order by document_type, day_number;

-- 10. topic_slug absents de public.topics
select
  i.reference_id,
  i.topic_slug
from public.guide_reference_items i
left join public.topics t on t.slug = i.topic_slug
where i.guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
  and i.topic_slug is not null
  and t.slug is null
order by i.reference_id;

-- 11. Lignes orphelines PROGRAM_DAY / FINAL_TEST
select
  i.reference_id,
  i.document_type,
  i.day_number,
  i.guide_day_id
from public.guide_reference_items i
left join public.guide_day_reference d on d.id = i.guide_day_id
where i.guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
  and i.document_type in ('PROGRAM_DAY', 'FINAL_TEST')
  and d.id is null
order by i.reference_id;

-- 12. Contraintes diagnostic
select
  reference_id,
  guide_day_id,
  day_number
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
  and document_type = 'DIAGNOSTIC'
  and (guide_day_id is not null or day_number is not null)
order by reference_id;

-- 13. Répartition answer_status
select
  answer_status,
  count(*) as item_count
from public.guide_reference_items
where guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
group by answer_status
order by answer_status;

-- 14. Test critique de cohérence
select
  'PROGRAM_DAY' as expected_document_type,
  'J1' as expected_day_reference,
  'Pages 4-5' as expected_pages,
  'DIAGNOSTIC' as detected_document_type,
  'DIAG-01' as detected_reference_min,
  'DIAG-26' as detected_reference_max,
  'MISMATCH' as expected_result
where exists (
  select 1
  from public.guide_day_reference d
  where d.guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
    and d.day_reference = 'J1'
)
and exists (
  select 1
  from public.guide_reference_items i
  where i.guide_code = 'guide-1-diagnostic-passerelle-3e-v2'
    and i.document_type = 'DIAGNOSTIC'
);
