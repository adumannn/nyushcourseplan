create table if not exists public.catalog_schools (
  slug text primary key,
  name text not null,
  is_published boolean not null default false,
  source_file text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_subjects (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null references public.catalog_schools(slug) on delete cascade,
  slug text not null,
  code text not null,
  name text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_subjects_school_slug_slug_key unique (school_slug, slug)
);

create table if not exists public.catalog_courses (
  id text primary key,
  subject_id uuid not null references public.catalog_subjects(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  credits_min int,
  credits_max int,
  is_variable_credit boolean not null default false,
  prerequisite_note text not null default '',
  fulfillment_text text not null default '',
  offering_text text not null default '',
  offering_terms text[] not null default '{}',
  validation_issues jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_courses_valid_credit_range check (
    credits_min is null
    or credits_max is null
    or credits_min <= credits_max
  )
);

create table if not exists public.catalog_course_relationships (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.catalog_courses(id) on delete cascade,
  related_course_id text not null,
  relationship_type text not null,
  raw_note text not null default '',
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint catalog_course_relationships_valid_type check (
    relationship_type in ('prerequisite', 'corequisite', 'antirequisite')
  ),
  constraint catalog_course_relationships_unique unique (
    course_id,
    related_course_id,
    relationship_type
  )
);

create table if not exists public.catalog_course_attributes (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.catalog_courses(id) on delete cascade,
  attribute_text text not null,
  created_at timestamptz not null default now(),
  constraint catalog_course_attributes_unique unique (course_id, attribute_text)
);

create table if not exists public.catalog_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_slug text not null,
  source_file text not null,
  status text not null default 'started',
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint catalog_import_runs_valid_status check (
    status in ('started', 'completed', 'failed')
  )
);

create index if not exists idx_catalog_subjects_school_slug
  on public.catalog_subjects(school_slug);

create index if not exists idx_catalog_subjects_school_slug_code
  on public.catalog_subjects(school_slug, code);

create index if not exists idx_catalog_courses_subject_id
  on public.catalog_courses(subject_id);

create index if not exists idx_catalog_courses_is_published
  on public.catalog_courses(is_published);

create index if not exists idx_catalog_courses_offering_terms
  on public.catalog_courses using gin (offering_terms);

create index if not exists idx_catalog_course_relationships_course_id
  on public.catalog_course_relationships(course_id);

create index if not exists idx_catalog_course_relationships_related_course_id
  on public.catalog_course_relationships(related_course_id);

create index if not exists idx_catalog_course_relationships_is_resolved
  on public.catalog_course_relationships(is_resolved);

create index if not exists idx_catalog_course_attributes_course_id
  on public.catalog_course_attributes(course_id);

create index if not exists idx_catalog_import_runs_source_slug
  on public.catalog_import_runs(source_slug);

create index if not exists idx_catalog_import_runs_status
  on public.catalog_import_runs(status);

alter table public.catalog_schools enable row level security;
alter table public.catalog_subjects enable row level security;
alter table public.catalog_courses enable row level security;
alter table public.catalog_course_relationships enable row level security;
alter table public.catalog_course_attributes enable row level security;
alter table public.catalog_import_runs enable row level security;

create policy "Published catalog schools are readable"
  on public.catalog_schools
  for select
  using (is_published);

create policy "Published catalog subjects are readable"
  on public.catalog_subjects
  for select
  using (
    is_published
    and exists (
      select 1
      from public.catalog_schools school
      where school.slug = catalog_subjects.school_slug
        and school.is_published
    )
  );

create policy "Published catalog courses are readable"
  on public.catalog_courses
  for select
  using (
    is_published
    and exists (
      select 1
      from public.catalog_subjects subject
      join public.catalog_schools school
        on school.slug = subject.school_slug
      where subject.id = catalog_courses.subject_id
        and subject.is_published
        and school.is_published
    )
  );

create policy "Published course relationships are readable"
  on public.catalog_course_relationships
  for select
  using (
    exists (
      select 1
      from public.catalog_courses course
      where course.id = catalog_course_relationships.course_id
        and course.is_published
    )
  );

create policy "Published course attributes are readable"
  on public.catalog_course_attributes
  for select
  using (
    exists (
      select 1
      from public.catalog_courses course
      where course.id = catalog_course_attributes.course_id
        and course.is_published
    )
  );

drop trigger if exists on_catalog_schools_updated on public.catalog_schools;
create trigger on_catalog_schools_updated
  before update on public.catalog_schools
  for each row execute function public.handle_updated_at();

drop trigger if exists on_catalog_subjects_updated on public.catalog_subjects;
create trigger on_catalog_subjects_updated
  before update on public.catalog_subjects
  for each row execute function public.handle_updated_at();

drop trigger if exists on_catalog_courses_updated on public.catalog_courses;
create trigger on_catalog_courses_updated
  before update on public.catalog_courses
  for each row execute function public.handle_updated_at();
