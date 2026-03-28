-- Plans table
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'My Plan',
  major text not null default 'cs',
  student_name text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Plan courses table
create table public.plan_courses (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade not null,
  semester_id text not null,
  course_id text not null,
  custom_name text,
  custom_credits int,
  custom_category text,
  position int not null default 0,
  created_at timestamptz default now()
);

-- Row-level security
alter table public.plans enable row level security;
alter table public.plan_courses enable row level security;

create policy "Users manage own plans"
  on public.plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own plan courses"
  on public.plan_courses for all
  using (plan_id in (select id from public.plans where user_id = auth.uid()))
  with check (plan_id in (select id from public.plans where user_id = auth.uid()));

-- Index for faster lookups
create index idx_plans_user_id on public.plans(user_id);
create index idx_plan_courses_plan_id on public.plan_courses(plan_id);

-- Auto-update updated_at on plans
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_plans_updated
  before update on public.plans
  for each row execute function public.handle_updated_at();
