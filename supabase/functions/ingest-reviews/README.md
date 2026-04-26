# ingest-reviews

Pulls the public community-review Google Doc (Chinese, freeform), trims it
to passages that mention a NYU Shanghai course (by code or full name), and
asks Gemini 2.5 Flash Lite to return structured per-course and per-professor
review summaries. Results land in `course_reviews` and
`course_professor_reviews`. A SHA-256 of the doc text is stored on each row
of `review_ingest_runs` so the function can skip Gemini entirely when the
doc hasn't changed since the last successful run.

The doc is treated as freeform — there is no required heading convention.
The model is responsible for matching mentions in the doc back to a
`course_id` from the catalog (by code, full name, or context). Entries it
cannot map confidently are dropped.

## Architecture

The Gemini call's wall time is bounded by the Supabase edge function's
~150s idle timeout, and Gemini's free-tier per-minute and per-day request
quotas. To stay inside both budgets the function:

1. Loads the catalog from `public.catalog_courses` (~900 rows).
2. Prunes the catalog to ~100-150 courses whose code or name appears in the
   doc text.
3. Trims the doc to lines mentioning a pruned course plus a small context
   window (typically reduces 500KB → 50KB).
4. Splits the trimmed doc into N chunks and runs **two parallel passes** for
   each chunk: a course-level summary pass and a per-professor commentary
   pass. The two passes use separate response schemas so each call's output
   stays well under MAX_TOKENS.
5. Merges results: dedupes by `course_id` for courses, by
   `(course_id, professor_name)` for professors. Course-id strings returned
   in unexpected formats (e.g. `"CSCI-SHU 220"` instead of `"CSCI-SHU-220"`)
   are normalized back to canonical IDs via a code/id alias map.
6. Drops obvious stub values (`""`, `"Unstated"`, `"N/A"`, etc.) and skips
   entries that contain no real review content.
7. Upserts cleaned rows. The `raw_zh` column is intentionally not populated
   on new rows: asking Gemini to copy verbatim Chinese excerpts roughly
   doubles output tokens and pushed us over MAX_TOKENS. The DB column stays
   so older rows keep their excerpts.

If a chunk fails (truncated output, transient 429, etc.) it is recorded in
`review_ingest_runs.unknown_course_codes` as a `__chunk_errors__: …`
diagnostic, but the rest of the chunks still upsert. Only when **every**
chunk fails is the run as a whole marked errored.

## Secrets

Set once per environment:

```bash
supabase secrets set GEMINI_API_KEY=<key>
supabase secrets set REVIEW_DOC_ID=<google-doc-id>
```

The doc must be shared with "Anyone with the link — Viewer". `REVIEW_DOC_ID`
is the segment between `/d/` and `/edit` in the doc URL.

## Local dev

```bash
supabase functions serve ingest-reviews --env-file ./supabase/.env.local
curl -X POST http://127.0.0.1:54321/functions/v1/ingest-reviews
```

`.env.local` should contain `GEMINI_API_KEY`, `REVIEW_DOC_ID`, and your local
Supabase URL / service role key.

## Deploy

```bash
supabase functions deploy ingest-reviews
```

## Invocation modes

```bash
# normal run — doc-hash-gated; Gemini is only called when the doc changes
curl -X POST $URL/functions/v1/ingest-reviews \
  -H "Authorization: Bearer $SERVICE_ROLE"

# force re-extract even when the doc is unchanged (e.g. after prompt changes)
curl -X POST $URL/functions/v1/ingest-reviews \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"force":true}'

# wait for the work synchronously (default is fire-and-forget; use this when
# debugging so curl returns the run summary). The function still respects the
# edge runtime's ~150s idle timeout.
curl -X POST $URL/functions/v1/ingest-reviews \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"force":true,"wait":true}'
```

A normal POST returns `202 { mode: "background", … }` immediately; the work
continues in `EdgeRuntime.waitUntil`. Poll `review_ingest_runs` for the
completion record.

## Scheduling

Migration `007_schedule_review_ingest.sql` installs a `pg_cron` job that
fires every hour at minute 7. Migration `009_review_cron_use_vault.sql`
rewrites it so the bearer token comes from Supabase Vault instead of
session-level GUCs (`alter database postgres set …` requires superuser
privileges that the management API doesn't have, so the GUC approach
silently failed).

Required one-time setup: insert the service-role JWT into vault under the
well-known name `ingest_reviews_service_role_key`. Either via SQL editor
(superuser session):

```sql
select vault.create_secret(
  '<service-role-jwt>',
  'ingest_reviews_service_role_key',
  'Used by ingest-reviews pg_cron job'
);
```

…or via the Supabase management API:

```bash
curl -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"select vault.create_secret('$SERVICE_KEY', 'ingest_reviews_service_role_key');\"}"
```

If the vault secret is missing, the cron job is a no-op (the WHERE clause
filters the http_post out), so a fresh project doesn't error every hour.

The project URL is hardcoded in migration 009 — fork the migration and
swap the URL for a different Supabase project.

Check runs via `select * from cron.job_run_details order by start_time desc`
and `select * from review_ingest_runs order by started_at desc`.

## Quota notes

Free-tier `gemini-2.5-flash-lite` is currently 15 RPM and 200 RPD. Each
ingest run makes 2 × CHUNKS calls (default CHUNKS=8 → 16 calls). At 16
calls per run, the daily budget covers ~12 successful runs — well within
the hourly cron schedule because the doc-hash gate skips Gemini entirely on
hours when the doc hasn't changed. If you change CHUNKS or the doc edit
cadence, recheck this math.
