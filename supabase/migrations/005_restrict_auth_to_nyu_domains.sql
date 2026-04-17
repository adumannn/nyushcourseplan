create or replace function public.is_allowed_nyu_email(email text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(email, '')) ~ '@(nyu\\.edu|nyu\\.edu\\.cn)$';
$$;

create or replace function public.requester_is_allowed_nyu()
returns boolean
language sql
stable
as $$
  select public.is_allowed_nyu_email(auth.jwt() ->> 'email');
$$;

drop policy if exists "Users manage own plans" on public.plans;
create policy "Users manage own plans"
  on public.plans for all
  using (
    auth.uid() = user_id
    and public.requester_is_allowed_nyu()
  )
  with check (
    auth.uid() = user_id
    and public.requester_is_allowed_nyu()
  );

drop policy if exists "Users manage own plan courses" on public.plan_courses;
create policy "Users manage own plan courses"
  on public.plan_courses for all
  using (
    public.requester_is_allowed_nyu()
    and plan_id in (select id from public.plans where user_id = auth.uid())
  )
  with check (
    public.requester_is_allowed_nyu()
    and plan_id in (select id from public.plans where user_id = auth.uid())
  );
