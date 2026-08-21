begin;

create table if not exists public.guide_day_reference (
  id uuid primary key default gen_random_uuid(),
  guide_code text not null,
  guide_title text not null,
  day_number integer not null check (day_number between 1 and 14),
  day_reference text not null,
  day_title text not null,
  mission text,
  page_start integer not null check (page_start > 0),
  page_end integer not null check (page_end >= page_start),
  topic_slugs jsonb not null default '[]'::jsonb,
  essential_reminder jsonb not null default '[]'::jsonb,
  document_type text not null check (document_type in ('PROGRAM_DAY', 'FINAL_TEST')),
  is_final_test boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guide_code, day_number),
  unique (guide_code, day_reference)
);

create table if not exists public.guide_reference_items (
  id uuid primary key default gen_random_uuid(),
  guide_day_id uuid null references public.guide_day_reference(id) on delete cascade,
  reference_id text not null unique,
  guide_code text not null,
  document_type text not null check (document_type in ('DIAGNOSTIC', 'PROGRAM_DAY', 'FINAL_TEST')),
  day_number integer null check (day_number between 1 and 14),
  section_code text not null,
  section_label text not null,
  level_code text,
  level_label text,
  item_order integer not null check (item_order >= 1),
  item_type text not null check (item_type in ('QUESTION', 'EXERCISE', 'MINI_TEST', 'REMINDER', 'INFO')),
  exercise_number text,
  title text,
  prompt_text text not null,
  topic_slug text null references public.topics(slug),
  skill_tested text,
  expected_answer text,
  accepted_answers jsonb not null default '[]'::jsonb,
  scoring_rules jsonb not null default '{}'::jsonb,
  common_errors jsonb not null default '[]'::jsonb,
  correction_ref text,
  answer_status text not null default 'NOT_YET_DEFINED'
    check (answer_status in ('DETERMINISTIC', 'MANUAL_REVIEW_REQUIRED', 'NOT_YET_DEFINED')),
  page_reference text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (document_type = 'DIAGNOSTIC' and guide_day_id is null and day_number is null)
    or
    (document_type in ('PROGRAM_DAY', 'FINAL_TEST') and guide_day_id is not null and day_number is not null)
  ),
  check (
    (document_type = 'FINAL_TEST' and day_number = 14)
    or
    (document_type <> 'FINAL_TEST')
  )
);

create index if not exists idx_guide_day_reference_lookup
  on public.guide_day_reference(guide_code, day_number);

create index if not exists idx_guide_day_reference_document_type
  on public.guide_day_reference(document_type, is_final_test);

create index if not exists idx_guide_day_reference_topic_slugs
  on public.guide_day_reference using gin (topic_slugs);

create index if not exists idx_guide_reference_items_day_section
  on public.guide_reference_items(guide_code, day_number, section_code, item_order);

create index if not exists idx_guide_reference_items_topic
  on public.guide_reference_items(topic_slug, document_type, day_number);

create index if not exists idx_guide_reference_items_guide_day
  on public.guide_reference_items(guide_day_id, section_code, level_code, item_order);

create index if not exists idx_guide_reference_items_metadata
  on public.guide_reference_items using gin (metadata);

alter table public.guide_day_reference enable row level security;
alter table public.guide_reference_items enable row level security;

drop policy if exists "authenticated_read_guide_day_reference" on public.guide_day_reference;
create policy "authenticated_read_guide_day_reference"
on public.guide_day_reference
for select
to authenticated
using (active = true);

drop policy if exists "authenticated_read_guide_reference_items" on public.guide_reference_items;
create policy "authenticated_read_guide_reference_items"
on public.guide_reference_items
for select
to authenticated
using (active = true);

comment on table public.guide_day_reference is
  'Référentiel pédagogique officiel du Guide 1 V2. Source de vérité PDF pour J1 à J14.';

comment on table public.guide_reference_items is
  'Éléments pédagogiques atomiques du Guide 1 V2: diagnostic, exercices, rappels, mini-tests et test final.';

comment on column public.guide_reference_items.answer_status is
  'DETERMINISTIC si la réponse attendue est stable et calculable, MANUAL_REVIEW_REQUIRED si plusieurs formulations/preuves sont possibles, NOT_YET_DEFINED sinon.';

commit;
