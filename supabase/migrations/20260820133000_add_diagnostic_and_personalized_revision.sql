begin;

alter table public.work_submissions
  add column if not exists submission_kind text not null default 'practice',
  add column if not exists reference_payload jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'work_submissions_submission_kind_check'
      and conrelid = 'public.work_submissions'::regclass
  ) then
    alter table public.work_submissions drop constraint work_submissions_submission_kind_check;
  end if;
end $$;

alter table public.work_submissions
  add constraint work_submissions_submission_kind_check
  check (submission_kind in ('practice', 'diagnostic'));

alter table public.ai_analyses
  add column if not exists analysis_kind text not null default 'practice',
  add column if not exists topic_results jsonb not null default '[]'::jsonb,
  add column if not exists next_steps jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'ai_analyses_analysis_kind_check'
      and conrelid = 'public.ai_analyses'::regclass
  ) then
    alter table public.ai_analyses drop constraint ai_analyses_analysis_kind_check;
  end if;
end $$;

alter table public.ai_analyses
  add constraint ai_analyses_analysis_kind_check
  check (analysis_kind in ('practice', 'diagnostic'));

update public.student_topic_progress
set mastery = 'a_renforcer'
where mastery = 'en_cours';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'student_topic_progress_mastery_check'
      and conrelid = 'public.student_topic_progress'::regclass
  ) then
    alter table public.student_topic_progress drop constraint student_topic_progress_mastery_check;
  end if;
end $$;

alter table public.student_topic_progress
  add constraint student_topic_progress_mastery_check
  check (mastery in ('pas_commence', 'maitrise', 'a_renforcer', 'a_reprendre'));

create unique index if not exists idx_student_topic_progress_student_topic_unique
  on public.student_topic_progress(student_id, topic_id)
  where topic_id is not null;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa1',
  'topic_slugs', jsonb_build_array('nombres-reels'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 1;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa1',
  'topic_slugs', jsonb_build_array('nombres-reels'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 2;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa3',
  'topic_slugs', jsonb_build_array('polynomes'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 3;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa3',
  'topic_slugs', jsonb_build_array('polynomes'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 4;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa3',
  'topic_slugs', jsonb_build_array('equations'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 5;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa4',
  'topic_slugs', jsonb_build_array('applications-lineaires'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 6;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa4',
  'topic_slugs', jsonb_build_array('applications-affines'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 7;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa1',
  'topic_slugs', jsonb_build_array('nombres-reels'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 8;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa1',
  'topic_slugs', jsonb_build_array('angles-cercles'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 9;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa1',
  'topic_slugs', jsonb_build_array('triangle-rectangle'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 10;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa4',
  'topic_slugs', jsonb_build_array('statistique'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 11;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa4',
  'topic_slugs', jsonb_build_array('nombres-reels', 'polynomes', 'equations', 'applications-lineaires', 'applications-affines', 'angles-cercles', 'triangle-rectangle', 'statistique'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 12;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa1',
  'topic_slugs', jsonb_build_array('triangle-rectangle', 'thales', 'applications-lineaires'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null
)
where day_number = 13;

update public.learning_program_days
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'learning_area_slug', 'sa4',
  'topic_slugs', jsonb_build_array('nombres-reels', 'polynomes', 'equations', 'applications-lineaires', 'applications-affines', 'angles-cercles', 'triangle-rectangle', 'statistique'),
  'guide_label', 'Guide Diagnostic & Révision',
  'page_reference', null,
  'is_diagnostic_checkpoint', true
)
where day_number = 14;

commit;
