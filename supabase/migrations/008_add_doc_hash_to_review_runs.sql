-- Track the source-doc hash on each ingest run so the function can skip
-- Gemini calls when the doc hasn't changed since the last successful run.

alter table public.review_ingest_runs
  add column if not exists doc_hash text;

create index if not exists idx_review_ingest_runs_doc_hash
  on public.review_ingest_runs(doc_hash);
