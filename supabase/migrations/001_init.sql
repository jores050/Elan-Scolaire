create table if not exists profiles (
  id uuid primary key,
  role text not null check (role in ('parent','admin')),
  full_name text not null,
  email text unique not null,
  active_license_id uuid null,
  created_at timestamptz default now()
);

create table if not exists students (
  id uuid primary key,
  parent_user_id uuid not null references profiles(id) on delete cascade,
  first_name text not null,
  level text not null default '3e',
  school text,
  current_area_slug text not null,
  current_topic_slug text not null,
  objective text not null,
  target_minutes integer not null default 35,
  study_days jsonb not null default '[1,2,4,6]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists license_keys (
  id uuid primary key,
  key_hash text not null unique,
  key_prefix text not null,
  key_suffix text not null,
  product text not null,
  status text not null check (status in ('available','activated','disabled','expired')),
  max_students integer not null default 2,
  created_at timestamptz default now(),
  activated_at timestamptz,
  activated_by uuid references profiles(id),
  expires_at timestamptz,
  order_reference text,
  notes text
);

create table if not exists license_activations (
  id uuid primary key,
  license_id uuid not null references license_keys(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  activated_at timestamptz default now(),
  visible_suffix text not null
);

create table if not exists subjects (
  id uuid primary key,
  name text not null,
  slug text not null unique
);

create table if not exists learning_areas (
  id uuid primary key,
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  slug text not null unique,
  order_index integer not null
);

create table if not exists topics (
  id uuid primary key,
  area_id uuid not null references learning_areas(id) on delete cascade,
  name text not null,
  slug text not null unique,
  order_index integer not null
);

create table if not exists exercises (
  id uuid primary key,
  document text not null,
  section text not null,
  exercise_number text not null,
  topic_id uuid null references topics(id),
  difficulty text not null,
  estimated_minutes integer not null,
  instructions text not null,
  correction_reference text
);

create table if not exists student_topic_progress (
  id uuid primary key,
  student_id uuid not null references students(id) on delete cascade,
  topic_id uuid null references topics(id),
  score integer not null,
  mastery text not null,
  updated_at timestamptz default now()
);

create table if not exists work_submissions (
  id uuid primary key,
  student_id uuid not null references students(id) on delete cascade,
  exercise_id uuid null references exercises(id),
  comment text,
  file_names jsonb not null default '[]'::jsonb,
  storage_paths jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists ai_analyses (
  id uuid primary key,
  submission_id uuid not null references work_submissions(id) on delete cascade,
  score integer not null,
  status text not null,
  points_forts jsonb not null default '[]'::jsonb,
  erreurs jsonb not null default '[]'::jsonb,
  notions_a_revoir jsonb not null default '[]'::jsonb,
  conseil_eleve text not null,
  conseil_parent text not null,
  exercices_recommandes jsonb not null default '[]'::jsonb,
  provider text not null,
  created_at timestamptz default now()
);

create table if not exists study_plans (
  id uuid primary key,
  student_id uuid not null references students(id) on delete cascade,
  exam_date date not null,
  created_at timestamptz default now()
);

create table if not exists study_plan_items (
  id uuid primary key,
  study_plan_id uuid not null references study_plans(id) on delete cascade,
  day_label text not null,
  topic text not null,
  exercises text not null
);

create table if not exists reminder_preferences (
  id uuid primary key,
  student_id uuid not null references students(id) on delete cascade,
  days jsonb not null default '[]'::jsonb,
  hour text not null
);

create table if not exists notifications (
  id uuid primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz default now(),
  read boolean not null default false
);

create table if not exists admin_audit_logs (
  id uuid primary key,
  actor_user_id uuid not null references profiles(id),
  action text not null,
  payload jsonb,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table students enable row level security;
alter table license_keys enable row level security;
alter table license_activations enable row level security;
alter table work_submissions enable row level security;
alter table ai_analyses enable row level security;
alter table notifications enable row level security;

create policy "parents_view_own_profile" on profiles for select using (auth.uid() = id);
create policy "parents_view_own_students" on students for select using (parent_user_id = auth.uid());
create policy "parents_manage_own_students" on students for all using (parent_user_id = auth.uid()) with check (parent_user_id = auth.uid());
create policy "parents_view_own_submissions" on work_submissions for select using (
  exists (select 1 from students s where s.id = student_id and s.parent_user_id = auth.uid())
);
create policy "parents_insert_own_submissions" on work_submissions for insert with check (
  exists (select 1 from students s where s.id = student_id and s.parent_user_id = auth.uid())
);
create policy "parents_view_own_analyses" on ai_analyses for select using (
  exists (
    select 1 from work_submissions ws
    join students s on s.id = ws.student_id
    where ws.id = submission_id and s.parent_user_id = auth.uid()
  )
);
create policy "parents_view_own_notifications" on notifications for select using (user_id = auth.uid());
