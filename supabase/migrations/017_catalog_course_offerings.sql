create table if not exists public.catalog_course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.catalog_courses(id) on delete cascade,
  school_slug text not null references public.catalog_schools(slug) on delete cascade,
  subject_slug text not null,
  subject_code text not null default '',
  subject_name text not null default '',
  campus_label text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_course_offerings_unique unique (
    course_id,
    school_slug,
    subject_slug
  )
);

create index if not exists idx_catalog_course_offerings_course_id
  on public.catalog_course_offerings(course_id);

create index if not exists idx_catalog_course_offerings_school_slug
  on public.catalog_course_offerings(school_slug);

create index if not exists idx_catalog_course_offerings_campus_label
  on public.catalog_course_offerings(campus_label);

alter table public.catalog_course_offerings enable row level security;

create policy "Published catalog course offerings are readable"
  on public.catalog_course_offerings
  for select
  using (
    is_published
    and exists (
      select 1
      from public.catalog_courses course
      join public.catalog_schools school
        on school.slug = catalog_course_offerings.school_slug
      where course.id = catalog_course_offerings.course_id
        and course.is_published
        and school.is_published
    )
  );

drop trigger if exists on_catalog_course_offerings_updated
  on public.catalog_course_offerings;
create trigger on_catalog_course_offerings_updated
  before update on public.catalog_course_offerings
  for each row execute procedure public.handle_updated_at();
