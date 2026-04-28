-- Replace plan metadata and all course rows in one database transaction.
-- Postgres functions execute atomically, so a failed insert rolls back the
-- preceding update/delete instead of leaving the user with an empty cloud plan.

create or replace function public.save_plan_with_courses(
  p_plan_id uuid,
  p_major text,
  p_student_name text,
  p_study_away_semesters text[],
  p_study_away_locations jsonb,
  p_courses jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(p_courses, '[]'::jsonb)) <> 'array' then
    raise exception 'p_courses must be a JSON array' using errcode = '22023';
  end if;

  update public.plans
  set
    major = coalesce(p_major, major),
    student_name = coalesce(p_student_name, ''),
    study_away_semesters = coalesce(p_study_away_semesters, '{}'::text[]),
    study_away_locations = coalesce(p_study_away_locations, '{}'::jsonb)
  where id = p_plan_id
    and user_id = (select auth.jwt()->>'sub');

  if not found then
    raise exception 'Plan not found or access denied' using errcode = '42501';
  end if;

  delete from public.plan_courses
  where plan_id = p_plan_id;

  insert into public.plan_courses (
    plan_id,
    semester_id,
    course_id,
    position,
    selected_credits,
    course_snapshot,
    custom_name,
    custom_credits,
    custom_category
  )
  select
    p_plan_id,
    course_row.semester_id,
    course_row.course_id,
    coalesce(course_row.position, 0),
    course_row.selected_credits,
    course_row.course_snapshot,
    course_row.custom_name,
    course_row.custom_credits,
    course_row.custom_category
  from jsonb_to_recordset(coalesce(p_courses, '[]'::jsonb)) as course_row(
    semester_id text,
    course_id text,
    position int,
    selected_credits int,
    course_snapshot jsonb,
    custom_name text,
    custom_credits int,
    custom_category text
  )
  where course_row.semester_id is not null
    and course_row.course_id is not null;
end;
$$;

revoke all on function public.save_plan_with_courses(uuid, text, text, text[], jsonb, jsonb) from public;
grant execute on function public.save_plan_with_courses(uuid, text, text, text[], jsonb, jsonb) to authenticated;
