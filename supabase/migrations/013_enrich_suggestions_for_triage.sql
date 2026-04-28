-- Add reviewer-friendly context to suggestions so feedback can be triaged
-- without joining against Clerk or plan tables.

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
