alter table public.plans
  add column if not exists study_away_semesters text[] not null default '{}',
  add column if not exists study_away_locations jsonb not null default '{}'::jsonb;