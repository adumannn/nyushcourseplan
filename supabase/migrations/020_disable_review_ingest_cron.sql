-- Disable the legacy edge-function review-ingest cron. Ingestion now runs as a
-- GitHub Action (scripts/ingest-reviews.mjs) instead of pg_cron POSTing to the
-- ingest-reviews edge function. Safe to run even if the job is already gone.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ingest-reviews-hourly') then
    perform cron.unschedule('ingest-reviews-hourly');
  end if;
end $$;
