-- ============================================================
-- Combined catch-up migration for remote Supabase
-- Safe to run even if some parts are already applied.
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Migration 002: Add study-away columns to plans ──────────
alter table public.plans
  add column if not exists study_away_semesters text[] not null default '{}',
  add column if not exists study_away_locations jsonb not null default '{}'::jsonb;

-- ── Migration 004: Add course snapshot to plan_courses ──────
alter table public.plan_courses
  add column if not exists selected_credits int,
  add column if not exists course_snapshot jsonb;

create index if not exists idx_plan_courses_plan_id_semester_position
  on public.plan_courses(plan_id, semester_id, position);

create index if not exists idx_plan_courses_course_id
  on public.plan_courses(course_id);

-- ── Step 1: Drop existing RLS policies (they reference user_id) ─
drop policy if exists "Users manage own plans" on public.plans;
drop policy if exists "Users manage own plan courses" on public.plan_courses;

-- ── Step 2: Convert user_id from uuid to text (for Clerk IDs) ──
alter table public.plans
  drop constraint if exists plans_user_id_fkey;

alter table public.plans
  alter column user_id type text using user_id::text;

-- ── Step 3: Recreate RLS policies with Clerk JWT ───────────────
-- Helper function for NYU email check (from migration 005)
create or replace function public.is_allowed_nyu_email(email text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(email, '')) ~ '@(nyu\.edu|nyu\.edu\.cn)$';
$$;

-- Plans: RLS policy using Clerk JWT sub claim
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

-- Plan courses: RLS policy using Clerk JWT sub claim
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

-- ── Migration 012/013: Suggestions / feedback table ─────────
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  category text not null default 'feature',
  message text not null,
  created_at timestamptz default now()
);

alter table public.suggestions enable row level security;

drop policy if exists "Users insert own suggestions" on public.suggestions;
drop policy if exists "Users read own suggestions" on public.suggestions;

create policy "Users insert own suggestions"
  on public.suggestions for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users read own suggestions"
  on public.suggestions for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

alter table public.suggestions
  add column if not exists contact_email text,
  add column if not exists contact_name text,
  add column if not exists page_path text,
  add column if not exists plan_id text,
  add column if not exists major text,
  add column if not exists total_credits int,
  add column if not exists user_agent text,
  add column if not exists status text not null default 'new',
  add column if not exists admin_notes text,
  add column if not exists reviewed_at timestamptz;

create index if not exists suggestions_created_at_idx
  on public.suggestions (created_at desc);

create index if not exists suggestions_status_created_at_idx
  on public.suggestions (status, created_at desc);

-- ── Migration 014: Feedback inbox admin grants ──────────────
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

-- ── Verify ──────────────────────────────────────────────────
-- Should show user_id as 'text' type
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'plans'
order by ordinal_position;

-- Should include public.suggestions and the feedback triage columns
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'suggestions'
order by ordinal_position;

-- Add your Clerk ID here to unlock the in-app feedback inbox.
-- You can copy it from the "Admin ID" badge in the inbox:
-- insert into public.feedback_admins (user_id, email)
-- values ('user_...', 'da3762@nyu.edu')
-- on conflict (user_id) do update set email = excluded.email;
