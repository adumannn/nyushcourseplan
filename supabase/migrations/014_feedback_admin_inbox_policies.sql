-- Admin grants for the in-app feedback inbox.
-- Add admins with:
-- insert into public.feedback_admins (user_id, email)
-- values ('user_...', 'admin@example.com')
-- on conflict (user_id) do update set email = excluded.email;

create table if not exists public.feedback_admins (
  user_id text primary key,
  email text,
  created_at timestamptz default now()
);

alter table public.feedback_admins enable row level security;

grant select on public.feedback_admins to authenticated;
grant select, update on public.suggestions to authenticated;

drop policy if exists "Users read own feedback admin grant" on public.feedback_admins;

create policy "Users read own feedback admin grant"
  on public.feedback_admins for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create or replace function public.is_feedback_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.feedback_admins
    where user_id = (select auth.jwt()->>'sub')
  );
$$;

revoke all on function public.is_feedback_admin() from public;
grant execute on function public.is_feedback_admin() to authenticated;

drop policy if exists "Feedback admins read all suggestions" on public.suggestions;
drop policy if exists "Feedback admins update suggestions" on public.suggestions;

create policy "Feedback admins read all suggestions"
  on public.suggestions for select to authenticated
  using (public.is_feedback_admin());

create policy "Feedback admins update suggestions"
  on public.suggestions for update to authenticated
  using (public.is_feedback_admin())
  with check (public.is_feedback_admin());
