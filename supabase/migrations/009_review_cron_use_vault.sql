-- Rewrite the ingest-reviews cron job to read its bearer token from
-- Supabase Vault instead of session-level GUCs (`app.settings.*`). The old
-- GUC approach required a one-off `alter database postgres set …` that needs
-- superuser privileges that the management API does not have, so the job
-- was silently failing on every fire because the GUCs were never set.
--
-- This migration:
--   1. Hardcodes the project URL — it is not secret and tying the cron job
--      to a specific project here is fine: each Supabase project gets its
--      own copy of this schema.
--   2. Looks up the service-role JWT from `vault.decrypted_secrets` by the
--      well-known name 'ingest_reviews_service_role_key'. If the secret is
--      missing the cron job is a no-op (so a fresh project doesn't error
--      every hour).
--
-- One-time setup before this migration is useful: insert the service-role
-- key into the vault. The repo's automation does this via the Supabase
-- management API; for a manual fork:
--
--     select vault.create_secret(
--       '<service-role-jwt>',
--       'ingest_reviews_service_role_key',
--       'Used by ingest-reviews pg_cron job'
--     );

create extension if not exists pg_cron;
create extension if not exists pg_net;

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
    with creds as (
      select decrypted_secret as token
      from vault.decrypted_secrets
      where name = 'ingest_reviews_service_role_key'
      limit 1
    )
    select net.http_post(
      url := 'https://pbyqozmqqkhgbnnjhsly.supabase.co/functions/v1/ingest-reviews',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select token from creds),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
    where exists (select 1 from creds);
  $$
);
