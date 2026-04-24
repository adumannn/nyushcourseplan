create table if not exists public.course_reviews (
  course_id text primary key,
  summary_en text,
  difficulty_en text,
  workload_en text,
  key_points_en text[] not null default '{}',
  content_hash text,
  raw_zh text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_professor_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  professor_name text not null,
  summary_en text,
  teaching_style_en text,
  pros_en text[] not null default '{}',
  cons_en text[] not null default '{}',
  content_hash text,
  raw_zh text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_professor_reviews_unique unique (course_id, professor_name)
);

create table if not exists public.review_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sections_total int not null default 0,
  sections_resummarized int not null default 0,
  unknown_course_codes text[] not null default '{}',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_course_professor_reviews_course_id
  on public.course_professor_reviews(course_id);

create index if not exists idx_review_ingest_runs_started_at
  on public.review_ingest_runs(started_at desc);

alter table public.course_reviews enable row level security;
alter table public.course_professor_reviews enable row level security;
alter table public.review_ingest_runs enable row level security;

create policy "Authenticated users read course reviews"
  on public.course_reviews
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users read professor reviews"
  on public.course_professor_reviews
  for select
  using (auth.role() = 'authenticated');

-- No client-side write policies: only the service role (used by the
-- ingest-reviews edge function) can insert/update/delete these rows.

drop trigger if exists on_course_reviews_updated on public.course_reviews;
create trigger on_course_reviews_updated
  before update on public.course_reviews
  for each row execute function public.handle_updated_at();

drop trigger if exists on_course_professor_reviews_updated on public.course_professor_reviews;
create trigger on_course_professor_reviews_updated
  before update on public.course_professor_reviews
  for each row execute function public.handle_updated_at();
