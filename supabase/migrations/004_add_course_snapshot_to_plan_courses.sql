alter table public.plan_courses
  add column if not exists selected_credits int,
  add column if not exists course_snapshot jsonb;

create index if not exists idx_plan_courses_plan_id_semester_position
  on public.plan_courses(plan_id, semester_id, position);

create index if not exists idx_plan_courses_course_id
  on public.plan_courses(course_id);

create index if not exists idx_plan_courses_selected_credits
  on public.plan_courses(selected_credits);

create index if not exists idx_plan_courses_course_snapshot_gin
  on public.plan_courses using gin (course_snapshot);

comment on column public.plan_courses.selected_credits is
  'Selected credit value for variable-credit courses. Null means use the catalog default credits.';

comment on column public.plan_courses.course_snapshot is
  'Snapshot of the course object at the time it was added to the plan, used to keep plans resilient when the runtime catalog source changes.';
