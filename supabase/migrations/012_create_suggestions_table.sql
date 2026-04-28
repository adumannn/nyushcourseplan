-- Suggestions / feedback submitted by authenticated users

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  category text not null default 'feature',
  message text not null,
  created_at timestamptz default now()
);

alter table public.suggestions enable row level security;

-- Users can insert their own suggestions
create policy "Users insert own suggestions"
  on public.suggestions for insert to authenticated
  with check (auth.jwt()->>'sub' = user_id);

-- Users can read their own suggestions
create policy "Users read own suggestions"
  on public.suggestions for select to authenticated
  using (auth.jwt()->>'sub' = user_id);
