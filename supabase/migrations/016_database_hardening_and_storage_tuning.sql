-- Conservative database hardening and storage tuning.
--
-- This migration intentionally avoids deleting, merging, or reshaping existing
-- user data. NOT VALID check constraints are used so existing legacy rows are
-- left untouched while future writes are held to the planner's current shape.

-- Drop indexes that were created for queries the app does not issue. Course
-- snapshots are only read by plan_id, and selected_credits is never filtered
-- independently.
drop index if exists public.idx_plan_courses_course_snapshot_gin;
drop index if exists public.idx_plan_courses_selected_credits;

-- Match the cloud-plan lookup in src/lib/planStorage.js:
--   where user_id = ? order by created_at asc limit 1
drop index if exists public.idx_plans_user_id;
create index if not exists idx_plans_user_id_created_at
  on public.plans(user_id, created_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plans_user_id_not_blank'
      and conrelid = 'public.plans'::regclass
  ) then
    alter table public.plans
      add constraint plans_user_id_not_blank
      check (length(btrim(user_id)) > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'plans_major_not_blank'
      and conrelid = 'public.plans'::regclass
  ) then
    alter table public.plans
      add constraint plans_major_not_blank
      check (length(btrim(major)) > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'plans_name_not_blank'
      and conrelid = 'public.plans'::regclass
  ) then
    alter table public.plans
      add constraint plans_name_not_blank
      check (length(btrim(name)) > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'plan_courses_semester_id_valid'
      and conrelid = 'public.plan_courses'::regclass
  ) then
    alter table public.plan_courses
      add constraint plan_courses_semester_id_valid
      check (
        semester_id in (
          'Y1-Fall',
          'Y1-Spring',
          'Y2-Fall',
          'Y2-Spring',
          'Y3-Fall',
          'Y3-Spring',
          'Y4-Fall',
          'Y4-Spring'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'plan_courses_position_nonnegative'
      and conrelid = 'public.plan_courses'::regclass
  ) then
    alter table public.plan_courses
      add constraint plan_courses_position_nonnegative
      check (position >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'plan_courses_selected_credits_positive'
      and conrelid = 'public.plan_courses'::regclass
  ) then
    alter table public.plan_courses
      add constraint plan_courses_selected_credits_positive
      check (selected_credits is null or selected_credits > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'plan_courses_custom_credits_positive'
      and conrelid = 'public.plan_courses'::regclass
  ) then
    alter table public.plan_courses
      add constraint plan_courses_custom_credits_positive
      check (custom_credits is null or custom_credits > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'suggestions_status_valid'
      and conrelid = 'public.suggestions'::regclass
  ) then
    alter table public.suggestions
      add constraint suggestions_status_valid
      check (status in ('new', 'reviewing', 'done', 'ignored')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'suggestions_category_valid'
      and conrelid = 'public.suggestions'::regclass
  ) then
    alter table public.suggestions
      add constraint suggestions_category_valid
      check (category in ('feature', 'bug', 'course-data', 'usability', 'other')) not valid;
  end if;
end;
$$;

-- Keep suggestion policies aligned with the optimized Clerk JWT style used by
-- plan policies. Admin inbox policies from migration 014 remain unchanged.
drop policy if exists "Users insert own suggestions" on public.suggestions;
drop policy if exists "Users read own suggestions" on public.suggestions;

create policy "Users insert own suggestions"
  on public.suggestions for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users read own suggestions"
  on public.suggestions for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);
