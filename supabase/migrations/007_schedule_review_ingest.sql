-- Schedule an hourly run of the ingest-reviews edge function via pg_cron.
--
-- This migration is intentionally conservative about assumptions:
--
--   * pg_cron and pg_net must be available on the Supabase instance. They
--     ship enabled on all paid tiers and on the free tier for new projects,
--     but older projects may need them enabled via the dashboard first.
--   * Two database-level settings must be configured before the cron job
--     can actually fire. These are NOT committed to source and must be set
--     by the project owner once, via the Supabase SQL editor:
--
--         alter database postgres
--           set app.settings.edge_url = 'https://<project-ref>.supabase.co';
--         alter database postgres
--           set app.settings.service_role_key = '<service-role-key>';
--
--     The cron job will fail gracefully (logging an error in
--     cron.job_run_details) until both are set.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any previously scheduled copy of this job so this migration is
-- idempotent. cron.unschedule throws if the job does not exist, so guard it.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ingest-reviews-hourly') then
    perform cron.unschedule('ingest-reviews-hourly');
  end if;
end
$$;

select cron.schedule(
  'ingest-reviews-hourly',
  '7 * * * *',
  $$
    select net.http_post(
      url := current_setting('app.settings.edge_url', true) || '/functions/v1/ingest-reviews',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
