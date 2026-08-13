
-- ============================================================
-- ELAN SCOLAIRE
-- Intégration du guide : PRÊT POUR LA 3e EN 14 JOURS
-- Source : Pret_pour_la_3e_en_14_jours_V2 (édition rentrée 2026-2027)
-- Usage : Supabase SQL Editor / migration PostgreSQL
-- Important : ce script n'efface aucune donnée existante.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) STRUCTURE DU PROGRAMME 14 JOURS
-- ------------------------------------------------------------

create table if not exists public.learning_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  product_code text not null,
  country text not null default 'Bénin',
  grade text not null default '3e',
  edition text,
  total_days integer not null default 14 check (total_days > 0),
  estimated_minutes_min integer,
  estimated_minutes_max integer,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.learning_programs(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 365),
  day_kind text not null default 'lesson'
    check (day_kind in ('lesson','consolidation','bridge','final_test')),
  title text not null,
  domain text,
  diagnostic_area text,
  objective text,
  estimated_minutes_min integer,
  estimated_minutes_max integer,
  retain_points jsonb not null default '[]'::jsonb,
  method_steps jsonb not null default '[]'::jsonb,
  path_guidance jsonb not null default '{}'::jsonb,
  why_it_helps_3e text,
  self_check jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, day_number)
);

create table if not exists public.learning_program_items (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.learning_program_days(id) on delete cascade,
  item_type text not null
    check (item_type in ('guided_example','exercise','challenge','real_situation','final_test_question')),
  item_order integer not null check (item_order >= 0),
  title text,
  prompt text not null,
  guide_reference text not null,
  correction_reference text,
  difficulty_label text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_day_id, item_type, item_order)
);

-- ------------------------------------------------------------
-- 2) SUIVI DE L'ÉLÈVE DANS LE PROGRAMME
-- ------------------------------------------------------------

create table if not exists public.student_program_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  program_id uuid not null references public.learning_programs(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active','completed','paused')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, program_id)
);

create table if not exists public.student_program_day_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.student_program_enrollments(id) on delete cascade,
  program_day_id uuid not null references public.learning_program_days(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','completed','needs_review')),
  started_at timestamptz,
  completed_at timestamptz,
  last_score numeric(5,2),
  needs_review boolean not null default false,
  parent_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(enrollment_id, program_day_id)
);

create table if not exists public.student_program_item_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.student_program_enrollments(id) on delete cascade,
  program_item_id uuid not null references public.learning_program_items(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','completed','needs_review')),
  score numeric(5,2),
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(enrollment_id, program_item_id)
);

create index if not exists idx_learning_program_days_program
  on public.learning_program_days(program_id, day_number);

create index if not exists idx_learning_program_items_day
  on public.learning_program_items(program_day_id, item_type, item_order);

create index if not exists idx_student_program_enrollments_student
  on public.student_program_enrollments(student_id);

create index if not exists idx_student_program_day_progress_enrollment
  on public.student_program_day_progress(enrollment_id);

create index if not exists idx_student_program_item_progress_enrollment
  on public.student_program_item_progress(enrollment_id);

-- Lier facultativement une copie envoyée au jour / exercice du programme.
alter table public.work_submissions
  add column if not exists program_day_id uuid
    references public.learning_program_days(id) on delete set null;

alter table public.work_submissions
  add column if not exists program_item_id uuid
    references public.learning_program_items(id) on delete set null;

create index if not exists idx_work_submissions_program_day
  on public.work_submissions(program_day_id);

create index if not exists idx_work_submissions_program_item
  on public.work_submissions(program_item_id);

-- ------------------------------------------------------------
-- 3) RLS : CONTENU PREMIUM EN LECTURE, PROGRESSION PROPRIÉTAIRE
-- ------------------------------------------------------------

alter table public.learning_programs enable row level security;
alter table public.learning_program_days enable row level security;
alter table public.learning_program_items enable row level security;
alter table public.student_program_enrollments enable row level security;
alter table public.student_program_day_progress enable row level security;
alter table public.student_program_item_progress enable row level security;

drop policy if exists "premium_read_learning_programs" on public.learning_programs;
create policy "premium_read_learning_programs"
on public.learning_programs
for select
to authenticated
using (
  active = true
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.active_license_id is not null or p.role = 'admin')
  )
);

drop policy if exists "premium_read_learning_program_days" on public.learning_program_days;
create policy "premium_read_learning_program_days"
on public.learning_program_days
for select
to authenticated
using (
  active = true
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.active_license_id is not null or p.role = 'admin')
  )
);

drop policy if exists "premium_read_learning_program_items" on public.learning_program_items;
create policy "premium_read_learning_program_items"
on public.learning_program_items
for select
to authenticated
using (
  active = true
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.active_license_id is not null or p.role = 'admin')
  )
);

drop policy if exists "parents_manage_own_program_enrollments" on public.student_program_enrollments;
create policy "parents_manage_own_program_enrollments"
on public.student_program_enrollments
for all
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and s.parent_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and s.parent_user_id = auth.uid()
  )
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active_license_id is not null
  )
);

drop policy if exists "parents_manage_own_day_progress" on public.student_program_day_progress;
create policy "parents_manage_own_day_progress"
on public.student_program_day_progress
for all
to authenticated
using (
  exists (
    select 1
    from public.student_program_enrollments e
    join public.students s on s.id = e.student_id
    where e.id = enrollment_id
      and s.parent_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.student_program_enrollments e
    join public.students s on s.id = e.student_id
    where e.id = enrollment_id
      and s.parent_user_id = auth.uid()
  )
);

drop policy if exists "parents_manage_own_item_progress" on public.student_program_item_progress;
create policy "parents_manage_own_item_progress"
on public.student_program_item_progress
for all
to authenticated
using (
  exists (
    select 1
    from public.student_program_enrollments e
    join public.students s on s.id = e.student_id
    where e.id = enrollment_id
      and s.parent_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.student_program_enrollments e
    join public.students s on s.id = e.student_id
    where e.id = enrollment_id
      and s.parent_user_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 4) PROGRAMME PRINCIPAL
-- ------------------------------------------------------------

insert into public.learning_programs (
  slug, title, subtitle, product_code, country, grade, edition,
  total_days, estimated_minutes_min, estimated_minutes_max, active, metadata, updated_at
)
values (
  'pret-pour-la-3e-14-jours',
  'PRÊT POUR LA 3e — MATHS BÉNIN',
  'Programme guidé de 14 jours',
  'PRET-3E-MATHS-BENIN',
  'Bénin',
  '3e',
  'Rentrée 2026-2027',
  14,
  30,
  45,
  true,
  jsonb_build_object(
    'source_document', 'Pret_pour_la_3e_en_14_jours_V2',
    'purpose', 'Consolider les bases utiles, corriger les points fragiles et prendre de l''avance pour la 3e.',
    'general_rule', 'Comprendre une méthode → faire un exercice → corriger → refaire seul.',
    'parent_role', 'Vérifier surtout la régularité, le temps de travail et les difficultés qui reviennent.',
    'guide_format', '1 exemple guidé + 5 exercices progressifs + 1 Défi 3e + 1 situation réelle + bilan rapide'
  ),
  now()
)
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  product_code = excluded.product_code,
  edition = excluded.edition,
  total_days = excluded.total_days,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  active = excluded.active,
  metadata = excluded.metadata,
  updated_at = now();

-- ------------------------------------------------------------
-- 5) LES 14 JOURS
-- ------------------------------------------------------------

insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  1,
  'lesson',
  'Nombres rationnels et priorités opératoires',
  'Nombres et calculs',
  'questions Nombres et calculs',
  'Calculer sans changer l''ordre des opérations et manipuler correctement des nombres rationnels simples.',
  30,
  45,
  '["Dans un calcul sans parenthèses, les multiplications et divisions se font avant les additions et soustractions.", "Les parenthèses passent en premier.", "Pour additionner ou soustraire deux fractions, on les écrit avec un même dénominateur."]'::jsonb,
  '["Repère d''abord les parenthèses.", "Repère ensuite les multiplications et divisions.", "Effectue enfin les additions et soustractions, de gauche à droite.", "Pour les fractions, cherche un dénominateur commun avant d''additionner les numérateurs."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'En 3e, les calculs deviennent plus longs : nombres réels, racines carrées, trigonométrie et expressions algébriques. Une erreur de priorité au début fausse toute la suite.',
  '["Je respecte les priorités.", "Je sais mettre des fractions au même dénominateur.", "Je relis mon calcul avant de valider."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  2,
  'lesson',
  'Fractions et puissances',
  'Nombres et calculs',
  'fractions et puissances',
  'Calculer avec des fractions et utiliser les règles simples sur les puissances.',
  30,
  45,
  '["Une fraction se simplifie en divisant le numérateur et le dénominateur par un même nombre non nul.", "Pour des puissances de même base : a^m × a^n = a^(m+n).", "Une puissance n''est pas une multiplication de l''exposant : 2^3 = 2 × 2 × 2 = 8."]'::jsonb,
  '["Pour une fraction, cherche d''abord un diviseur commun au numérateur et au dénominateur.", "Pour un produit de puissances de même base, additionne les exposants.", "Pour une puissance d''une puissance, multiplie les exposants.", "Si les bases sont différentes, calcule séparément ou transforme seulement si une règle le permet."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'Les puissances servent en 3e pour les racines, les écritures scientifiques et le calcul littéral. Savoir simplifier une fraction aide aussi en trigonométrie et dans les rapports de Thalès.',
  '["Je simplifie une fraction proprement.", "Je distingue base et exposant.", "Je connais les règles de produit de puissances de même base."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  3,
  'lesson',
  'Réduire une expression littérale',
  'Calcul littéral',
  'réduction d''expressions',
  'Reconnaître les termes semblables et réduire une expression sans mélanger les familles.',
  30,
  45,
  '["3x et 5x sont des termes semblables : on peut les regrouper.", "3x et 3x² ne sont pas semblables.", "Les nombres seuls se regroupent entre eux."]'::jsonb,
  '["Repère les termes en x, les termes en x² et les nombres seuls.", "Regroupe seulement les termes de même nature.", "Additionne ou soustrais leurs coefficients.", "Relis l''expression obtenue pour vérifier qu''aucun terme semblable ne reste."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'En 3e, les polynômes et les équations demandent de réduire rapidement des expressions. Cette compétence devient un réflexe indispensable.',
  '["Je ne mélange pas x et x².", "Je sais regrouper les coefficients.", "Je sais remplacer x par une valeur donnée."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  4,
  'lesson',
  'Développer et factoriser',
  'Calcul littéral',
  'développement et factorisation',
  'Utiliser la distributivité pour développer et reconnaître un facteur commun pour factoriser.',
  30,
  45,
  '["Développer : k(a + b) = ka + kb.", "Factoriser est l''opération inverse : ka + kb = k(a + b).", "Après un développement, on réduit si des termes semblables apparaissent."]'::jsonb,
  '["Pour développer, multiplie le nombre placé devant la parenthèse par chaque terme à l''intérieur.", "Écris tous les produits.", "Réduis si nécessaire.", "Pour factoriser, cherche ce qui est commun à tous les termes et place-le devant une parenthèse."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'Le calcul littéral de 3e utilise les polynômes, les équations et les expressions liées aux droites. Développer et factoriser rapidement fait gagner du temps.',
  '["Je distribue le facteur à tous les termes.", "Je réduis après avoir développé.", "Je reconnais un facteur commun."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  5,
  'lesson',
  'Équations et mise en équation',
  'Équations et raisonnement algébrique',
  'équations',
  'Résoudre une équation du premier degré simple et traduire une petite situation par une équation.',
  30,
  45,
  '["Une équation est une égalité contenant une inconnue.", "Le but est d''isoler l''inconnue tout en conservant l''égalité.", "On peut effectuer la même opération sur les deux membres."]'::jsonb,
  '["Réduis chaque membre si nécessaire.", "Fais disparaître les additions ou soustractions autour de x.", "Fais ensuite disparaître la multiplication devant x.", "Vérifie en remplaçant x dans l''équation de départ."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'En 3e, on rencontre des équations, des inéquations et des équations de droites. La méthode d''isolement de l''inconnue reste la même idée de base.',
  '["Je sais isoler x.", "Je vérifie ma solution.", "Je sais transformer une phrase simple en équation."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  6,
  'lesson',
  'Proportionnalité et quatrième proportionnelle',
  'Proportionnalité et problèmes',
  'prix/quantité et quatrième proportionnelle',
  'Résoudre une situation proportionnelle avec un passage à l''unité ou un produit en croix.',
  30,
  45,
  '["Deux grandeurs sont proportionnelles si l''on passe de l''une à l''autre en multipliant toujours par le même nombre.", "Le passage à l''unité est souvent la méthode la plus simple.", "Dans une proportion a/b = c/d, on peut utiliser l''égalité des produits en croix : ad = bc."]'::jsonb,
  '["Identifie les deux grandeurs : quantité/prix, distance/temps, etc.", "Vérifie que la situation est proportionnelle.", "Choisis : passage à l''unité ou produit en croix.", "Écris l''unité dans la réponse pour éviter une réponse sans sens."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'En 3e, une application linéaire correspond à une situation de proportionnalité. Le coefficient de proportionnalité devient le coefficient de la fonction.',
  '["Je reconnais une situation proportionnelle.", "Je sais passer à l''unité.", "Je sais utiliser un produit en croix."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  7,
  'lesson',
  'Pourcentages et problèmes concrets',
  'Proportionnalité et problèmes',
  'pourcentage et problèmes',
  'Calculer un pourcentage, une réduction simple et un partage proportionnel.',
  30,
  45,
  '["p % d''une quantité signifie p/100 de cette quantité.", "Pour calculer 15 % de 8 000, on fait 15/100 × 8 000.", "Après une réduction, on soustrait le montant de la réduction au prix initial."]'::jsonb,
  '["Transforme le pourcentage en fraction sur 100 ou en nombre décimal.", "Multiplie par la quantité de départ.", "Demande-toi si la question veut le montant du pourcentage ou la valeur finale.", "Écris une phrase de réponse."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'Les pourcentages se relient aux fonctions linéaires et affines en 3e : une augmentation ou une réduction peut être modélisée par un coefficient multiplicateur.',
  '["Je calcule p % d''une quantité.", "Je distingue réduction et prix final.", "Je sais interpréter un pourcentage."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  8,
  'lesson',
  'PGCD, PPCM et fractions irréductibles',
  'Arithmétique',
  'PGCD, PPCM, multiples',
  'Calculer un PGCD ou un PPCM et savoir lequel utiliser dans un problème.',
  30,
  45,
  '["PGCD = plus grand diviseur commun. Il sert souvent à partager en groupes identiques aussi grands que possible.", "PPCM = plus petit multiple commun. Il sert souvent à trouver quand plusieurs phénomènes se produiront de nouveau ensemble.", "Le PGCD permet aussi de simplifier une fraction jusqu''à sa forme irréductible."]'::jsonb,
  '["Pour un petit nombre : liste les diviseurs ou les multiples.", "Pour des nombres plus grands : décompose en facteurs premiers.", "PGCD : garde les facteurs communs avec les plus petits exposants.", "PPCM : prends tous les facteurs nécessaires avec les plus grands exposants.", "Relis le problème : partage = souvent PGCD ; retour simultané = souvent PPCM."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'En 3e, l''arithmétique sert à travailler les fractions irréductibles, les nombres réels et certains problèmes. Savoir choisir PGCD ou PPCM évite les méthodes au hasard.',
  '["Je connais la différence PGCD/PPCM.", "Je sais simplifier une fraction avec le PGCD.", "Je reconnais un problème de retour simultané."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  9,
  'lesson',
  'Propriétés géométriques essentielles',
  'Géométrie',
  'propriétés géométriques',
  'Mobiliser quelques propriétés utiles sur triangles, parallèles, médiatrice et cercle.',
  30,
  45,
  '["Dans un triangle, la somme des angles vaut 180°.", "Un point de la médiatrice d''un segment est à égale distance des extrémités de ce segment.", "Deux droites perpendiculaires à une même droite sont parallèles.", "Dans un cercle, un rayon relie le centre à un point du cercle."]'::jsonb,
  '["Lis d''abord les informations de la figure.", "Repère ce qui est donné : angle, parallèle, perpendiculaire, égalité de longueurs.", "Choisis une propriété qui utilise exactement ces informations.", "Écris la propriété avant le calcul ou la conclusion."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'En 3e, Thalès, triangles semblables, trigonométrie et angles dans les cercles exigent de reconnaître une configuration avant de lancer un calcul.',
  '["Je cite une propriété avant de conclure.", "Je sais utiliser 180° dans un triangle.", "Je repère médiatrice, parallèle et perpendiculaire."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  10,
  'lesson',
  'Triangle rectangle et propriété de Pythagore',
  'Géométrie',
  'triangle rectangle',
  'Utiliser la propriété de Pythagore et sa réciproque dans des cas simples.',
  30,
  45,
  '["Dans un triangle rectangle, l''hypoténuse est le côté opposé à l''angle droit : c''est le plus long côté.", "Si ABC est rectangle en A, alors BC² = AB² + AC².", "La réciproque permet de vérifier qu''un triangle est rectangle."]'::jsonb,
  '["Repère l''angle droit et l''hypoténuse.", "Écris la propriété avec les lettres de la figure.", "Remplace par les longueurs connues.", "Calcule le carré manquant puis la longueur positive.", "Pour la réciproque, compare le carré du plus grand côté à la somme des carrés des deux autres."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'La trigonométrie de 3e travaille encore dans le triangle rectangle. Pythagore aide à calculer une longueur ; sinus, cosinus et tangente relient ensuite longueurs et angles.',
  '["Je reconnais l''hypoténuse.", "J''écris correctement l''égalité de Pythagore.", "Je sais vérifier si un triangle est rectangle."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  11,
  'lesson',
  'Statistiques : effectif, fréquence et moyenne',
  'Données et statistiques',
  'effectif, fréquence, moyenne',
  'Calculer un effectif total, une fréquence, une moyenne et interpréter une petite série.',
  30,
  45,
  '["L''effectif total est le nombre total d''observations.", "La fréquence d''une modalité = effectif de la modalité / effectif total.", "La moyenne = somme des valeurs / nombre de valeurs, ou moyenne pondérée si des effectifs sont donnés."]'::jsonb,
  '["Organise les données dans un tableau si nécessaire.", "Calcule l''effectif total.", "Pour une fréquence, divise l''effectif de la catégorie par le total.", "Pour la moyenne, additionne les valeurs en tenant compte de leurs effectifs, puis divise par le total.", "Interprète avec une phrase."]'::jsonb,
  '{"rouge": "fais les 5 exercices + la situation réelle + le Défi 3e.", "orange": "fais les exercices 2 à 5 + la situation réelle + le Défi 3e.", "vert": "relis l''exemple, fais les exercices 4 et 5, puis la situation réelle et le Défi 3e."}'::jsonb,
  'En 3e, les données peuvent être regroupées en classes et représentées par des diagrammes circulaires ou des histogrammes. Les notions d''effectif et de fréquence restent la base.',
  '["Je distingue effectif et fréquence.", "Je calcule une moyenne simple ou pondérée.", "Je donne une interprétation en phrase."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  12,
  'consolidation',
  'Entraînement mixte de consolidation',
  'Tous les domaines',
  'toutes les priorités',
  'Passer d''exercices isolés à des problèmes où la méthode n''est pas annoncée.',
  30,
  45,
  '["Le vrai progrès commence quand tu reconnais toi-même l''outil à utiliser.", "Avant de calculer, écris en marge : fraction ? équation ? proportionnalité ? Pythagore ? statistique ?", "Un problème peut demander deux méthodes successives."]'::jsonb,
  '["Lis une première fois sans calculer.", "Repère les données et la question.", "Nomme l''outil probable.", "Fais les calculs.", "Vérifie si la réponse est réaliste et comporte une unité."]'::jsonb,
  '{"priorite": "fais toute la séance : elle mélange plusieurs méthodes.", "consolidation": "essaie tout sans aide, puis reprends seulement tes erreurs.", "avance": "vise une solution propre, rapide et bien justifiée."}'::jsonb,
  'Les évaluations de 3e demandent souvent d''enchaîner plusieurs idées dans une même situation-problème. Cette séance travaille précisément ce choix de méthode.',
  '["Je nomme la méthode avant de calculer.", "Je sais enchaîner deux étapes.", "Je vérifie les unités et la vraisemblance."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  13,
  'bridge',
  'Passerelle vers la 3e',
  'Avance 3e',
  'à faire surtout après consolidation',
  'Relier les acquis de 4e à trois thèmes de 3e : racines carrées, Thalès et applications linéaires.',
  30,
  45,
  '["Racine carrée : √a est le nombre positif dont le carré vaut a (pour a ≥ 0).", "Thalès relie des longueurs lorsque des droites sont parallèles dans une configuration de triangle.", "Une application linéaire g(x) = ax traduit une proportionnalité."]'::jsonb,
  '["Station 1 - Racines : cherche le nombre dont le carré donne la valeur demandée.", "Station 2 - Thalès : repère le triangle et les droites parallèles avant d''écrire des rapports.", "Station 3 - Application linéaire : repère le coefficient de proportionnalité a dans g(x) = ax.", "Ne cherche pas à tout mémoriser aujourd''hui : le but est de reconnaître les idées."]'::jsonb,
  '{"rouge": "termine d''abord tes journées prioritaires.", "orange": "fais cette passerelle après avoir corrigé tes erreurs importantes.", "vert": "fais toute la séance : elle prépare directement la 3e."}'::jsonb,
  'Le guide officiel de 3e au Bénin introduit notamment les nombres réels, la trigonométrie, Thalès, les applications affines/linéaires, les équations de droites et la statistique. Aujourd''hui, tu as seulement construit les premiers ponts.',
  '["Je reconnais une racine carrée simple.", "Je sais qu''une application linéaire traduit une proportionnalité.", "Je reconnais une configuration de Thalès sans encore vouloir tout démontrer."]'::jsonb,
  '{}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_days (
  program_id, day_number, day_kind, title, domain, diagnostic_area, objective,
  estimated_minutes_min, estimated_minutes_max, retain_points, method_steps,
  path_guidance, why_it_helps_3e, self_check, metadata, active, updated_at
)
select
  p.id,
  14,
  'final_test',
  'Test final et bilan',
  'Tous les domaines',
  'comparaison avec le diagnostic initial',
  '21 questions pour vérifier les bases après 13 jours de travail.',
  30,
  45,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"test_final": "travaille sans le guide, sans correction et sans aide.", "objectif": "compare tes erreurs et tes progrès, pas seulement ton score."}'::jsonb,
  'Le programme de 14 jours n''est pas une préparation complète au BEPC. Il sert d''abord à consolider les bases et à créer une bonne méthode de travail.',
  '[]'::jsonb,
  '{"instructions": ["Fais ce test sans regarder les journées précédentes.", "Prépare une feuille de brouillon.", "Compte 1 point par bonne réponse.", "Le but n''est pas d''obtenir 21/21 à tout prix : compare surtout tes progrès et tes erreurs."], "score_bands": [{"min": 18, "max": 21, "label": "Bases testées solides", "next": "Passe surtout aux défis 3e et aux exercices de la bibliothèque."}, {"min": 14, "max": 17, "label": "Bon ensemble, quelques consolidations", "next": "Reprends les domaines où tu as perdu des points."}, {"min": 9, "max": 13, "label": "Plusieurs bases restent à consolider", "next": "Refais les jours liés aux erreurs avant d''avancer."}, {"min": 0, "max": 8, "label": "Bases prioritaires à reprendre", "next": "Travaille une notion à la fois et demande de l''aide si une difficulté persiste."}]}'::jsonb,
  true,
  now()
from public.learning_programs p
where p.slug = 'pret-pour-la-3e-14-jours'
on conflict (program_id, day_number) do update set
  day_kind = excluded.day_kind,
  title = excluded.title,
  domain = excluded.domain,
  diagnostic_area = excluded.diagnostic_area,
  objective = excluded.objective,
  estimated_minutes_min = excluded.estimated_minutes_min,
  estimated_minutes_max = excluded.estimated_minutes_max,
  retain_points = excluded.retain_points,
  method_steps = excluded.method_steps,
  path_guidance = excluded.path_guidance,
  why_it_helps_3e = excluded.why_it_helps_3e,
  self_check = excluded.self_check,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();

-- ------------------------------------------------------------
-- 6) CONTENU DE CHAQUE JOUR : EXEMPLE, EXERCICES, DÉFI, SITUATION
-- ------------------------------------------------------------


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Calcule A = 18 - 2 × (5 + 1).',
       'Guide élève — Jour 1 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Parenthèses : 5 + 1 = 6.", "Multiplication : 2 × 6 = 12.", "Soustraction : 18 - 12 = 6."], "answer": "A = 6.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 1
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Calcule 14 + 3 × 5.',
       'Guide élève — Jour 1 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 1 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 1
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Calcule 30 - 4 × (2 + 3).',
       'Guide élève — Jour 1 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 1 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 1
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Calcule 5/6 + 1/3.',
       'Guide élève — Jour 1 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 1 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 1
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Calcule 7/8 - 1/4.',
       'Guide élève — Jour 1 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 1 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 1
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Range dans l''ordre croissant : -3/2 ; 0,5 ; -1 ; 3/4.',
       'Guide élève — Jour 1 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 1 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 1
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Un commerçant possède 24 000 FCFA. Il dépense d''abord le quart de cette somme puis 3 500 FCFA. Quelle somme lui reste-t-il ?',
       'Guide élève — Jour 1 — Défi 3e',
       'Corrigés détaillés — Jour 1 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 1
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — BUDGET DE RENTRÉE', 'Awa dispose de 30 000 FCFA. Elle dépense 2/5 de cette somme pour les fournitures puis 6 500 FCFA pour un sac. Combien lui reste-t-il ? Écris les calculs dans l''ordre.',
       'Guide élève — Jour 1 — Situation réelle',
       'Corrigés détaillés — Jour 1 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 1
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Simplifie 18/24 puis calcule 2^3 × 2^2.',
       'Guide élève — Jour 2 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["18/24 se simplifie par 6 : 18 ÷ 6 = 3 et 24 ÷ 6 = 4.", "Donc 18/24 = 3/4.", "2^3 × 2^2 = 2^(3+2) = 2^5 = 32."], "answer": "3/4 et 32.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 2
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Simplifie 21/28.',
       'Guide élève — Jour 2 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 2 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 2
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Calcule 3/5 × 10/9.',
       'Guide élève — Jour 2 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 2 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 2
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Calcule 2^4 × 2^3.',
       'Guide élève — Jour 2 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 2 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 2
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Calcule (3^2)^2.',
       'Guide élève — Jour 2 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 2 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 2
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Écris 0,00045 sous la forme 4,5 × 10^n.',
       'Guide élève — Jour 2 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 2 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 2
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Sans calculatrice, compare 2^6 et 4^3. Explique pourquoi ils sont égaux ou non.',
       'Guide élève — Jour 2 — Défi 3e',
       'Corrigés détaillés — Jour 2 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 2
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — FORFAIT INTERNET', 'Un forfait contient 2^10 Mo. Un second contient 2^12 Mo. Combien de fois le second forfait est-il plus grand que le premier ? Justifie avec les puissances.',
       'Guide élève — Jour 2 — Situation réelle',
       'Corrigés détaillés — Jour 2 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 2
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Réduis E = 5x + 3 - 2x + 7.',
       'Guide élève — Jour 3 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Termes en x : 5x - 2x = 3x.", "Nombres : 3 + 7 = 10."], "answer": "E = 3x + 10.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 3
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Réduis 4x + 9x.',
       'Guide élève — Jour 3 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 3 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 3
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Réduis 7a - 3a + 5.',
       'Guide élève — Jour 3 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 3 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 3
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Réduis 2x + 5 - 6x + 3.',
       'Guide élève — Jour 3 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 3 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 3
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Réduis 3x² + 2x - x² + 5x.',
       'Guide élève — Jour 3 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 3 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 3
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Calcule la valeur de 3x + 10 pour x = 4.',
       'Guide élève — Jour 3 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 3 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 3
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Un rectangle a pour longueur (x + 4) cm et largeur (x + 1) cm. Écris puis réduis son périmètre.',
       'Guide élève — Jour 3 — Défi 3e',
       'Corrigés détaillés — Jour 3 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 3
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — PÉRIMÈTRE D''UN JARDIN', 'Un jardin rectangulaire a pour longueur (2x + 5) m et largeur (x + 2) m. Écris puis réduis son périmètre.',
       'Guide élève — Jour 3 — Situation réelle',
       'Corrigés détaillés — Jour 3 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 3
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Réduis F = 3(x + 2) - x.',
       'Guide élève — Jour 4 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Développe : 3(x + 2) = 3x + 6.", "Donc F = 3x + 6 - x.", "Réduis : 3x - x = 2x."], "answer": "F = 2x + 6.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 4
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Développe 5(x + 3).',
       'Guide élève — Jour 4 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 4 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 4
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Développe -2(x - 4).',
       'Guide élève — Jour 4 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 4 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 4
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Réduis 4(x + 1) + 2x.',
       'Guide élève — Jour 4 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 4 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 4
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Factorise 6x + 18.',
       'Guide élève — Jour 4 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 4 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 4
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Factorise 8a - 12.',
       'Guide élève — Jour 4 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 4 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 4
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Deux expressions sont proposées : A = 3(x + 5) et B = 3x + 15. Explique pourquoi elles donnent toujours le même résultat, quel que soit x.',
       'Guide élève — Jour 4 — Défi 3e',
       'Corrigés détaillés — Jour 4 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 4
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — FABRICATION DE TABLES', 'Le coût de fabrication de x petites tables est donné par C = 4 500(x + 2) + 1 500x. Développe et réduis C.',
       'Guide élève — Jour 4 — Situation réelle',
       'Corrigés détaillés — Jour 4 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 4
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Résous 3x + 4 = 19.',
       'Guide élève — Jour 5 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Soustrais 4 aux deux membres : 3x = 15.", "Divise les deux membres par 3 : x = 5.", "Vérification : 3 × 5 + 4 = 19."], "answer": "x = 5.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 5
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Résous x + 9 = 17.',
       'Guide élève — Jour 5 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 5 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 5
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Résous 5x = 35.',
       'Guide élève — Jour 5 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 5 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 5
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Résous 2x + 3 = 17.',
       'Guide élève — Jour 5 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 5 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 5
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Résous 4x - 7 = 13.',
       'Guide élève — Jour 5 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 5 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 5
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Un taxi facture 500 FCFA de prise en charge puis 300 FCFA par kilomètre. Une course coûte 2 000 FCFA. Écris une équation pour trouver la distance parcourue.',
       'Guide élève — Jour 5 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 5 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 5
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Le périmètre d''un rectangle est 30 cm. Sa longueur vaut x + 3 et sa largeur vaut x. Écris une équation puis trouve x.',
       'Guide élève — Jour 5 — Défi 3e',
       'Corrigés détaillés — Jour 5 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 5
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — TRANSPORT SCOLAIRE', 'Un conducteur demande 600 FCFA de prise en charge puis 250 FCFA par kilomètre. Une course coûte 2 350 FCFA. Quelle distance a été parcourue ?',
       'Guide élève — Jour 5 — Situation réelle',
       'Corrigés détaillés — Jour 5 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 5
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', '3 kg de riz coûtent 1 500 FCFA. Combien coûtent 5 kg ?',
       'Guide élève — Jour 6 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Prix de 1 kg : 1 500 ÷ 3 = 500 FCFA.", "Prix de 5 kg : 500 × 5 = 2 500 FCFA."], "answer": "5 kg coûtent 2 500 FCFA.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 6
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', '4 cahiers coûtent 1 200 FCFA. Combien coûtent 7 cahiers ?',
       'Guide élève — Jour 6 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 6 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 6
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', '6 m de tissu coûtent 7 200 FCFA. Quel est le prix de 10 m ?',
       'Guide élève — Jour 6 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 6 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 6
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Une moto parcourt 90 km avec 3 L de carburant. Combien de litres faut-il pour 150 km, si la consommation reste la même ?',
       'Guide élève — Jour 6 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 6 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 6
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Complète : 5/8 = x/24.',
       'Guide élève — Jour 6 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 6 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 6
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Un plan est à l''échelle 1/50 000. À quoi correspondent 4 cm sur le plan dans la réalité ?',
       'Guide élève — Jour 6 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 6 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 6
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Deux boutiques proposent le même paquet : 3 paquets pour 2 400 FCFA ou 5 paquets pour 3 750 FCFA. Quelle offre est la moins chère par paquet ?',
       'Guide élève — Jour 6 — Défi 3e',
       'Corrigés détaillés — Jour 6 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 6
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — ACHAT DE RIZ', 'Au marché, 7 kg de riz coûtent 4 550 FCFA. À prix proportionnel, combien faut-il payer pour 12 kg ? Présente une méthode complète.',
       'Guide élève — Jour 6 — Situation réelle',
       'Corrigés détaillés — Jour 6 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 6
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Un sac coûte 8 000 FCFA et bénéficie d''une réduction de 15 %.',
       'Guide élève — Jour 7 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Montant de la réduction : 15/100 × 8 000 = 1 200 FCFA.", "Prix après réduction : 8 000 - 1 200 = 6 800 FCFA."], "answer": "Le nouveau prix est 6 800 FCFA.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 7
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Calcule 25 % de 12 000 FCFA.',
       'Guide élève — Jour 7 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 7 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 7
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Un article de 5 000 FCFA augmente de 10 %. Quel est le montant de l''augmentation ?',
       'Guide élève — Jour 7 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 7 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 7
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Un élève réussit 18 questions sur 24. Quel pourcentage de réussite cela représente-t-il ?',
       'Guide élève — Jour 7 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 7 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 7
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Partage 18 000 FCFA entre A et B proportionnellement à 2 et 3.',
       'Guide élève — Jour 7 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 7 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 7
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Dans un collège de 600 élèves, 55 % sont des filles. Combien y a-t-il de filles ?',
       'Guide élève — Jour 7 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 7 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 7
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Un téléphone affiché à 60 000 FCFA subit une réduction de 10 %, puis une réduction supplémentaire de 5 % sur le nouveau prix. Le prix final est-il égal à une réduction directe de 15 % ? Justifie.',
       'Guide élève — Jour 7 — Défi 3e',
       'Corrigés détaillés — Jour 7 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 7
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — PROMOTION DE RENTRÉE', 'Une paire de chaussures coûte 18 000 FCFA. Le vendeur accorde 15 % de réduction. Le client paie avec 20 000 FCFA. Combien doit-on lui rendre ?',
       'Guide élève — Jour 7 — Situation réelle',
       'Corrigés détaillés — Jour 7 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 7
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Trouve le PGCD de 36 et 48 puis simplifie 36/48.',
       'Guide élève — Jour 8 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["36 = 2² × 3² et 48 = 2⁴ × 3.", "Facteurs communs avec les plus petits exposants : 2² × 3 = 12.", "36/48 = (36 ÷ 12)/(48 ÷ 12) = 3/4."], "answer": "PGCD(36,48) = 12 et 36/48 = 3/4.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 8
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Calcule le PGCD de 18 et 30.',
       'Guide élève — Jour 8 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 8 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 8
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Réduis 42/56 à une fraction irréductible.',
       'Guide élève — Jour 8 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 8 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 8
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Calcule le PPCM de 6 et 8.',
       'Guide élève — Jour 8 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 8 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 8
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Deux marchés ont lieu tous les 4 jours et tous les 6 jours. Ils ont lieu ensemble aujourd''hui. Dans combien de jours auront-ils de nouveau lieu ensemble ?',
       'Guide élève — Jour 8 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 8 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 8
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'On veut répartir 48 mangues et 60 oranges dans le plus grand nombre possible de paniers identiques, sans reste. Combien de paniers peut-on faire ?',
       'Guide élève — Jour 8 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 8 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 8
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Trois activités reviennent tous les 4, 5 et 6 jours. Elles ont lieu ensemble aujourd''hui. Dans combien de jours se retrouveront-elles le même jour ?',
       'Guide élève — Jour 8 — Défi 3e',
       'Corrigés détaillés — Jour 8 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 8
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — ORGANISATION D''ACTIVITÉS', 'Trois clubs se réunissent tous les 6 jours, 8 jours et 12 jours. Ils se réunissent ensemble aujourd''hui. Dans combien de jours se retrouveront-ils le même jour ?',
       'Guide élève — Jour 8 — Situation réelle',
       'Corrigés détaillés — Jour 8 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 8
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Dans le triangle ABC, A = 52° et B = 68°. Calcule C.',
       'Guide élève — Jour 9 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Somme des angles d''un triangle : A + B + C = 180°.", "C = 180° - 52° - 68° = 60°."], "answer": "C = 60°.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 9
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Dans un triangle, deux angles mesurent 35° et 75°. Calcule le troisième.',
       'Guide élève — Jour 9 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 9 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 9
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Le point M appartient à la médiatrice de [AB] et MA = 6 cm. Quelle est la longueur MB ? Justifie.',
       'Guide élève — Jour 9 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 9 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 9
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Les droites (d1) et (d2) sont toutes deux perpendiculaires à (d). Quelle relation existe entre (d1) et (d2) ?',
       'Guide élève — Jour 9 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 9 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 9
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Un cercle a un rayon de 4 cm. Quel est son diamètre ?',
       'Guide élève — Jour 9 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 9 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 9
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Dans un triangle isocèle en A, l''angle A mesure 40°. Calcule les deux autres angles.',
       'Guide élève — Jour 9 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 9 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 9
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Construis sur une feuille un triangle ABC, puis la médiatrice de [AB]. Place un point M sur cette médiatrice et vérifie à la règle que MA et MB sont égales.',
       'Guide élève — Jour 9 — Défi 3e',
       'Corrigés détaillés — Jour 9 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 9
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — PARCELLE TRIANGULAIRE', 'Dans un triangle ABC, l''angle A mesure 48° et l''angle B mesure 67°. Calcule C. Puis explique en une phrase pourquoi aucune mesure d''angle d''un triangle ne peut être choisie au hasard.',
       'Guide élève — Jour 9 — Situation réelle',
       'Corrigés détaillés — Jour 9 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 9
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'ABC est rectangle en A, AB = 6 cm et AC = 8 cm. Calcule BC.',
       'Guide élève — Jour 10 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["BC est l''hypoténuse.", "BC² = AB² + AC² = 6² + 8² = 36 + 64 = 100.", "BC = 10 car une longueur est positive."], "answer": "BC = 10 cm.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 10
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Un triangle rectangle a pour côtés de l''angle droit 5 cm et 12 cm. Calcule l''hypoténuse.',
       'Guide élève — Jour 10 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 10 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 10
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'ABC est rectangle en B. AC = 13 cm et AB = 5 cm. Calcule BC.',
       'Guide élève — Jour 10 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 10 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 10
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Les côtés d''un triangle mesurent 6 cm, 8 cm et 10 cm. Est-il rectangle ? Justifie.',
       'Guide élève — Jour 10 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 10 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 10
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Une échelle de 5 m est posée contre un mur. Son pied est à 3 m du mur. À quelle hauteur arrive-t-elle ?',
       'Guide élève — Jour 10 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 10 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 10
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Un terrain rectangulaire mesure 24 m sur 10 m. Calcule la longueur de sa diagonale.',
       'Guide élève — Jour 10 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 10 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 10
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Une corde de 15 m relie le sommet d''un poteau au sol à 9 m du pied du poteau. Calcule la hauteur du poteau.',
       'Guide élève — Jour 10 — Défi 3e',
       'Corrigés détaillés — Jour 10 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 10
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — POTEAU ET CÂBLE', 'Un câble de 17 m relie le sommet d''un poteau au sol, à 8 m du pied du poteau. Calcule la hauteur du poteau.',
       'Guide élève — Jour 10 — Situation réelle',
       'Corrigés détaillés — Jour 10 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 10
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Les notes sont 8 ; 10 ; 10 ; 12 ; 15. Calcule la moyenne.',
       'Guide élève — Jour 11 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Somme = 8 + 10 + 10 + 12 + 15 = 55.", "Effectif total = 5.", "Moyenne = 55 ÷ 5 = 11."], "answer": "La moyenne est 11/20.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 11
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Dans une classe de 24 élèves, 6 ont choisi l''option A. Calcule la fréquence sous forme de fraction puis en pourcentage.',
       'Guide élève — Jour 11 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 11 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 11
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Calcule la moyenne de 7 ; 9 ; 10 ; 14.',
       'Guide élève — Jour 11 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 11 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 11
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Une série contient : 2 fois la note 8, 3 fois la note 10 et 1 fois la note 14. Calcule l''effectif total.',
       'Guide élève — Jour 11 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 11 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 11
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Pour la même série, calcule la moyenne.',
       'Guide élève — Jour 11 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 11 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 11
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Sur 40 élèves, 18 sont des filles. Quelle est la fréquence des filles en pourcentage ?',
       'Guide élève — Jour 11 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 11 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 11
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Une classe a les notes suivantes : 8 (4 élèves), 10 (6 élèves), 12 (5 élèves), 14 (3 élèves), 16 (2 élèves). Calcule la moyenne de la classe et identifie la note la plus fréquente.',
       'Guide élève — Jour 11 — Défi 3e',
       'Corrigés détaillés — Jour 11 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 11
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — RÉSULTATS D''UNE CLASSE', 'Les notes d''un groupe sont : 8 ; 9 ; 10 ; 10 ; 11 ; 12 ; 15 ; 15. Calcule l''effectif, la moyenne et la fréquence de la note 15.',
       'Guide élève — Jour 11 — Situation réelle',
       'Corrigés détaillés — Jour 11 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 11
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Un article de 12 000 FCFA est réduit de 20 %. Avec la somme économisée, on achète 3 cahiers au même prix. Quel est le prix d''un cahier ?',
       'Guide élève — Jour 12 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["Réduction : 20/100 × 12 000 = 2 400 FCFA.", "La somme économisée est 2 400 FCFA.", "Prix d''un cahier : 2 400 ÷ 3 = 800 FCFA."], "answer": "Un cahier coûte 800 FCFA.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 12
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Un terrain rectangulaire mesure 18 m sur 24 m. Calcule sa diagonale.',
       'Guide élève — Jour 12 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 12 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 12
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Une famille achète 5 kg de riz à 600 FCFA le kg et 3 L d''huile à 1 200 FCFA le litre. Calcule la dépense totale.',
       'Guide élève — Jour 12 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 12 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 12
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Résous 4(x - 2) = 20.',
       'Guide élève — Jour 12 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 12 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 12
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'Réduis puis calcule pour x = 3 : A = 2(x + 4) + x.',
       'Guide élève — Jour 12 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 12 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 12
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Sur 30 élèves, 12 viennent à pied. Donne la fréquence en pourcentage.',
       'Guide élève — Jour 12 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 12 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 12
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Un club compte 48 membres. 37,5 % sont des filles. Les garçons sont répartis en équipes de 6. Combien d''équipes complètes de garçons peut-on former ?',
       'Guide élève — Jour 12 — Défi 3e',
       'Corrigés détaillés — Jour 12 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 12
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — MINI-PROBLÈME MIXTE', 'Une famille achète 6 cahiers à 450 FCFA l''unité. Elle bénéficie ensuite d''une remise de 10 % sur le total. Avec la somme économisée, elle achète des stylos à 135 FCFA l''unité. Combien de stylos complets peut-elle acheter ?',
       'Guide élève — Jour 12 — Situation réelle',
       'Corrigés détaillés — Jour 12 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 12
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'guided_example', 0, 'Exemple expliqué', 'Une quantité y est toujours égale à 3 fois x. Écris la relation et calcule y pour x = 5.',
       'Guide élève — Jour 13 — Exemple expliqué',
       NULL, 'guidé', '{"steps": ["La situation est proportionnelle de coefficient 3.", "On peut écrire g(x) = 3x.", "g(5) = 3 × 5 = 15."], "answer": "y = 15.", "display_label": "Exemple expliqué"}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 13
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 1, 'Exercice 1', 'Calcule √49, √81 et √100.',
       'Guide élève — Jour 13 — À toi de jouer — Exercice 1',
       'Corrigés détaillés — Jour 13 — Exercice 1',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 13
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 2, 'Exercice 2', 'Un carré a une aire de 64 cm². Quelle est la longueur de son côté ?',
       'Guide élève — Jour 13 — À toi de jouer — Exercice 2',
       'Corrigés détaillés — Jour 13 — Exercice 2',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 13
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 3, 'Exercice 3', 'Dans un tableau de proportionnalité, y = 4x. Calcule y pour x = 7 puis trouve x quand y = 36.',
       'Guide élève — Jour 13 — À toi de jouer — Exercice 3',
       'Corrigés détaillés — Jour 13 — Exercice 3',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 13
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 4, 'Exercice 4', 'On considère g(x) = 5x. Calcule g(2), g(-3) et g(0).',
       'Guide élève — Jour 13 — À toi de jouer — Exercice 4',
       'Corrigés détaillés — Jour 13 — Exercice 4',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 13
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'exercise', 5, 'Exercice 5', 'Dans un triangle ABC, M appartient à [AB], N à [AC] et MN est parallèle à BC. Sans calculer, cite le théorème de 3e qui permettra de relier AM, AB, AN et AC.',
       'Guide élève — Jour 13 — À toi de jouer — Exercice 5',
       'Corrigés détaillés — Jour 13 — Exercice 5',
       NULL, '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 13
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'challenge', 6, 'Défi 3e', 'Une rampe forme un triangle rectangle avec le sol. Sa longueur est 5 m et sa hauteur 3 m. Calcule la distance horizontale, puis explique quel nouvel outil de 3e pourrait servir si l''on cherchait l''angle de la rampe.',
       'Guide élève — Jour 13 — Défi 3e',
       'Corrigés détaillés — Jour 13 — Défi 3e',
       'Défi 3e', '{}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 13
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'real_situation', 7, 'Situation réelle — PREMIÈRE PASSERELLE 3E', 'Une petite entreprise facture un service selon g(x)=2 500x. Calcule g(3) et g(7). Explique pourquoi cette situation est une proportionnalité et ce que représente 2 500.',
       'Guide élève — Jour 13 — Situation réelle',
       'Corrigés détaillés — Jour 13 — Situation réelle',
       'contexte réel', '{"before_calculating": "Avant de calculer : écris le nom de la méthode que tu vas utiliser."}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 13
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  difficulty_label = excluded.difficulty_label,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


-- JOUR 14 : TEST FINAL — 21 QUESTIONS


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 1, 'Question 1', 'Calcule 18 - 3 × 4.',
       'Guide élève — Jour 14 — Test final — Question 1',
       'Corrigés détaillés — Jour 14 — Question 1',
       NULL, '{"domain": "Nombres et calculs", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 2, 'Question 2', 'Calcule 3/4 + 5/8.',
       'Guide élève — Jour 14 — Test final — Question 2',
       'Corrigés détaillés — Jour 14 — Question 2',
       NULL, '{"domain": "Nombres et calculs", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 3, 'Question 3', 'Calcule 2^4 × 2^2.',
       'Guide élève — Jour 14 — Test final — Question 3',
       'Corrigés détaillés — Jour 14 — Question 3',
       NULL, '{"domain": "Nombres et calculs", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 4, 'Question 4', 'Réduis 7x - 2x + 4.',
       'Guide élève — Jour 14 — Test final — Question 4',
       'Corrigés détaillés — Jour 14 — Question 4',
       NULL, '{"domain": "Calcul littéral", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 5, 'Question 5', 'Développe 4(x - 3).',
       'Guide élève — Jour 14 — Test final — Question 5',
       'Corrigés détaillés — Jour 14 — Question 5',
       NULL, '{"domain": "Calcul littéral", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 6, 'Question 6', 'Factorise 6x + 12.',
       'Guide élève — Jour 14 — Test final — Question 6',
       'Corrigés détaillés — Jour 14 — Question 6',
       NULL, '{"domain": "Calcul littéral", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 7, 'Question 7', 'Résous x - 8 = 5.',
       'Guide élève — Jour 14 — Test final — Question 7',
       'Corrigés détaillés — Jour 14 — Question 7',
       NULL, '{"domain": "Équations", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 8, 'Question 8', 'Résous 3x + 2 = 20.',
       'Guide élève — Jour 14 — Test final — Question 8',
       'Corrigés détaillés — Jour 14 — Question 8',
       NULL, '{"domain": "Équations", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 9, 'Question 9', 'Un nombre multiplié par 4 puis augmenté de 3 donne 27. Quel est ce nombre ?',
       'Guide élève — Jour 14 — Test final — Question 9',
       'Corrigés détaillés — Jour 14 — Question 9',
       NULL, '{"domain": "Équations", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 10, 'Question 10', '5 cahiers coûtent 2 000 FCFA. Combien coûtent 8 cahiers ?',
       'Guide élève — Jour 14 — Test final — Question 10',
       'Corrigés détaillés — Jour 14 — Question 10',
       NULL, '{"domain": "Proportionnalité", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 11, 'Question 11', 'Calcule 15 % de 20 000 FCFA.',
       'Guide élève — Jour 14 — Test final — Question 11',
       'Corrigés détaillés — Jour 14 — Question 11',
       NULL, '{"domain": "Proportionnalité", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 12, 'Question 12', 'Complète : 3/5 = x/25.',
       'Guide élève — Jour 14 — Test final — Question 12',
       'Corrigés détaillés — Jour 14 — Question 12',
       NULL, '{"domain": "Proportionnalité", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 13, 'Question 13', 'Calcule le PGCD de 24 et 36.',
       'Guide élève — Jour 14 — Test final — Question 13',
       'Corrigés détaillés — Jour 14 — Question 13',
       NULL, '{"domain": "Arithmétique", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 14, 'Question 14', 'Réduis 30/45 à une fraction irréductible.',
       'Guide élève — Jour 14 — Test final — Question 14',
       'Corrigés détaillés — Jour 14 — Question 14',
       NULL, '{"domain": "Arithmétique", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 15, 'Question 15', 'Deux activités reviennent tous les 6 jours et 8 jours. Dans combien de jours auront-elles lieu ensemble ?',
       'Guide élève — Jour 14 — Test final — Question 15',
       'Corrigés détaillés — Jour 14 — Question 15',
       NULL, '{"domain": "Arithmétique", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 16, 'Question 16', 'Dans un triangle, deux angles mesurent 48° et 72°. Calcule le troisième.',
       'Guide élève — Jour 14 — Test final — Question 16',
       'Corrigés détaillés — Jour 14 — Question 16',
       NULL, '{"domain": "Géométrie", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 17, 'Question 17', 'ABC est rectangle en A, AB = 9 cm, AC = 12 cm. Calcule BC.',
       'Guide élève — Jour 14 — Test final — Question 17',
       'Corrigés détaillés — Jour 14 — Question 17',
       NULL, '{"domain": "Géométrie", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 18, 'Question 18', 'Les côtés 5 cm, 12 cm et 13 cm forment-ils un triangle rectangle ? Justifie.',
       'Guide élève — Jour 14 — Test final — Question 18',
       'Corrigés détaillés — Jour 14 — Question 18',
       NULL, '{"domain": "Géométrie", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 19, 'Question 19', 'Calcule la moyenne de 8 ; 10 ; 11 ; 15.',
       'Guide élève — Jour 14 — Test final — Question 19',
       'Corrigés détaillés — Jour 14 — Question 19',
       NULL, '{"domain": "Statistiques", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 20, 'Question 20', 'Dans une classe de 32 élèves, 8 ont choisi l''option A. Quelle est la fréquence en pourcentage ?',
       'Guide élève — Jour 14 — Test final — Question 20',
       'Corrigés détaillés — Jour 14 — Question 20',
       NULL, '{"domain": "Statistiques", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();


insert into public.learning_program_items (
  program_day_id, item_type, item_order, title, prompt, guide_reference,
  correction_reference, difficulty_label, metadata, active, updated_at
)
select d.id, 'final_test_question', 21, 'Question 21', 'Une note apparaît 7 fois dans une série de 25 notes. Quelle est sa fréquence sous forme de fraction ?',
       'Guide élève — Jour 14 — Test final — Question 21',
       'Corrigés détaillés — Jour 14 — Question 21',
       NULL, '{"domain": "Statistiques", "points": 1}'::jsonb, true, now()
from public.learning_program_days d
join public.learning_programs p on p.id = d.program_id
where p.slug = 'pret-pour-la-3e-14-jours' and d.day_number = 14
on conflict (program_day_id, item_type, item_order) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  guide_reference = excluded.guide_reference,
  correction_reference = excluded.correction_reference,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();

-- ------------------------------------------------------------
-- 7) DÉMARRER LE PROGRAMME POUR UN ÉLÈVE
-- Fonction SECURITY INVOKER : elle respecte RLS et vérifie l'appartenance.
-- ------------------------------------------------------------

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

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_license_id is not null
  ) then
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

revoke all on function public.start_pret_pour_la_3e_14_jours(uuid) from public;
revoke all on function public.start_pret_pour_la_3e_14_jours(uuid) from anon;
revoke all on function public.start_pret_pour_la_3e_14_jours(uuid) from authenticated;
grant execute on function public.start_pret_pour_la_3e_14_jours(uuid) to authenticated;

-- ------------------------------------------------------------
-- 8) VUE POUR LE DASHBOARD : "JOUR X SUR 14"
-- SECURITY INVOKER = les RLS des tables de base restent appliquées.
-- ------------------------------------------------------------

create or replace view public.v_student_pret_3e_progress
with (security_invoker = true)
as
select
  e.id as enrollment_id,
  e.student_id,
  e.program_id,
  p.title as program_title,
  p.total_days,
  count(dp.id) filter (where dp.status = 'completed')::integer as completed_days,
  round(
    100.0
    * count(dp.id) filter (where dp.status = 'completed')
    / nullif(p.total_days, 0),
    0
  )::integer as progress_percent,
  coalesce(
    min(d.day_number) filter (where dp.status <> 'completed'),
    p.total_days
  )::integer as current_day_number,
  e.status,
  e.started_at,
  e.completed_at
from public.student_program_enrollments e
join public.learning_programs p on p.id = e.program_id
join public.learning_program_days d on d.program_id = p.id and d.active = true
join public.student_program_day_progress dp
  on dp.enrollment_id = e.id
 and dp.program_day_id = d.id
where p.slug = 'pret-pour-la-3e-14-jours'
group by e.id, e.student_id, e.program_id, p.title, p.total_days, e.status, e.started_at, e.completed_at;

grant select on public.v_student_pret_3e_progress to authenticated;

-- ------------------------------------------------------------
-- 9) CONTRÔLES DE COHÉRENCE
-- Le résultat attendu après exécution :
-- 1 programme, 14 jours, 13 exemples, 65 exercices,
-- 13 défis, 13 situations réelles, 21 questions du test final.
-- ------------------------------------------------------------

do $$
declare
  v_programs integer;
  v_days integer;
  v_examples integer;
  v_exercises integer;
  v_challenges integer;
  v_situations integer;
  v_test_questions integer;
begin
  select count(*) into v_programs
  from public.learning_programs
  where slug = 'pret-pour-la-3e-14-jours';

  select count(*) into v_days
  from public.learning_program_days d
  join public.learning_programs p on p.id = d.program_id
  where p.slug = 'pret-pour-la-3e-14-jours';

  select count(*) filter (where i.item_type = 'guided_example'),
         count(*) filter (where i.item_type = 'exercise'),
         count(*) filter (where i.item_type = 'challenge'),
         count(*) filter (where i.item_type = 'real_situation'),
         count(*) filter (where i.item_type = 'final_test_question')
  into v_examples, v_exercises, v_challenges, v_situations, v_test_questions
  from public.learning_program_items i
  join public.learning_program_days d on d.id = i.program_day_id
  join public.learning_programs p on p.id = d.program_id
  where p.slug = 'pret-pour-la-3e-14-jours';

  if v_programs <> 1 then
    raise exception 'Guide seed invalid: expected 1 program, got %', v_programs;
  end if;
  if v_days <> 14 then
    raise exception 'Guide seed invalid: expected 14 days, got %', v_days;
  end if;
  if v_examples <> 13 then
    raise exception 'Guide seed invalid: expected 13 guided examples, got %', v_examples;
  end if;
  if v_exercises <> 65 then
    raise exception 'Guide seed invalid: expected 65 exercises, got %', v_exercises;
  end if;
  if v_challenges <> 13 then
    raise exception 'Guide seed invalid: expected 13 challenges, got %', v_challenges;
  end if;
  if v_situations <> 13 then
    raise exception 'Guide seed invalid: expected 13 real situations, got %', v_situations;
  end if;
  if v_test_questions <> 21 then
    raise exception 'Guide seed invalid: expected 21 final test questions, got %', v_test_questions;
  end if;
end $$;

commit;

-- ============================================================
-- REQUÊTES DE VÉRIFICATION (à lancer après le script)
-- ============================================================
--
-- 1) Vérifier les 14 jours :
-- select day_number, title, domain, objective
-- from public.learning_program_days d
-- join public.learning_programs p on p.id = d.program_id
-- where p.slug = 'pret-pour-la-3e-14-jours'
-- order by day_number;
--
-- 2) Vérifier le contenu d'un jour :
-- select i.item_type, i.item_order, i.title, i.prompt, i.guide_reference
-- from public.learning_program_items i
-- join public.learning_program_days d on d.id = i.program_day_id
-- join public.learning_programs p on p.id = d.program_id
-- where p.slug = 'pret-pour-la-3e-14-jours'
--   and d.day_number = 1
-- order by i.item_type, i.item_order;
--
-- 3) Démarrer le programme pour un élève connecté :
-- select public.start_pret_pour_la_3e_14_jours('<STUDENT_UUID>'::uuid);
--
-- 4) Lire la progression :
-- select *
-- from public.v_student_pret_3e_progress
-- where student_id = '<STUDENT_UUID>'::uuid;
-- ============================================================
