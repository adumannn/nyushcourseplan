-- Clerk user IDs are stable text values like `user_...`, not Supabase Auth UUIDs.
-- Store them directly so client inserts from Clerk sessions can pass type checks.
alter table public.plans
  drop constraint if exists plans_user_id_fkey;

alter table public.plans
  alter column user_id type text using user_id::text;

drop policy if exists "Users manage own plans" on public.plans;
create policy "Users manage own plans"
  on public.plans
  for all
  to authenticated
  using (
    (select auth.jwt()->>'sub') = user_id
  )
  with check (
    (select auth.jwt()->>'sub') = user_id
  );

drop policy if exists "Users manage own plan courses" on public.plan_courses;
create policy "Users manage own plan courses"
  on public.plan_courses
  for all
  to authenticated
  using (
    plan_id in (
      select id
      from public.plans
      where user_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    plan_id in (
      select id
      from public.plans
      where user_id = (select auth.jwt()->>'sub')
    )
  );

-- Keep catalog access publication-scoped; Clerk is not required for catalog reads.
drop policy if exists "Catalog courses are readable by all" on public.catalog_courses;

drop policy if exists "Authenticated users read course reviews" on public.course_reviews;
create policy "Authenticated users read course reviews"
  on public.course_reviews
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users read professor reviews" on public.course_professor_reviews;
create policy "Authenticated users read professor reviews"
  on public.course_professor_reviews
  for select
  to authenticated
  using (true);
