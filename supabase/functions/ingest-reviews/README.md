# ingest-reviews

Pulls the public community-review Google Doc (Chinese, freeform) and asks
Gemini 2.5 Flash to return structured per-course and per-professor review
summaries against the full NYU Shanghai catalog. Results land in `course_reviews` and
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

1. Loads the full catalog from `public.catalog_courses` (~922 rows).
2. Splits the full doc into 4 chunks and runs **two parallel passes** per
   chunk against `gemini-2.5-flash`: a course-level summary pass and a
   per-professor commentary pass. The two passes use separate response
   schemas so each call's output stays well under MAX_TOKENS. Each call
   carries the full catalog (~46KB) and one doc chunk (~14KB), about
   ~26K input tokens — well within Flash's 1M-token context.
3. Merges results: dedupes by `course_id` for courses, by
   `(course_id, professor_name)` for professors. Course-id strings returned
   in unexpected formats (e.g. `"CSCI-SHU 220"` instead of `"CSCI-SHU-220"`)
   are normalized back to canonical IDs via a code/id alias map.
4. Drops obvious stub values (`""`, `"Unstated"`, `"N/A"`, etc.) and skips
   entries that contain no real review content.
5. Upserts cleaned rows. The `raw_zh` column is intentionally not populated
   on new rows: asking Gemini to copy verbatim Chinese excerpts roughly
   doubles output tokens and pushed us over MAX_TOKENS. The DB column stays
   so older rows keep their excerpts.

### Why no pruning / trimming

A previous version of this function pruned the catalog to courses whose
literal code or full name appeared in the doc, and trimmed the doc to a
context window around those mentions. That cut prompts from ~530KB to
~50KB but lost ~86% of the catalog because students in this Chinese
community doc almost never write course codes (`CCSF-SHU 101L`) or full
names (`Global Perspectives on Society`). They write abbreviations: `GPS`,
`POH`, `STS`, `DBC`, `WAI`, `IPC`. The literal pruner had no concept of
nicknames so any course mentioned only by abbreviation was silently
dropped before Gemini ever saw it.

With `gemini-2.5-flash`'s 1M-token context and the prompt now explicitly
listing common student abbreviations, sending the full catalog + full doc
is faster, simpler, and dramatically improves coverage.

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

Free-tier `gemini-2.5-flash` is currently 10 RPM and 250 RPD. Each
ingest run makes 2 × CHUNKS calls (default CHUNKS=4 → 8 calls). 8 calls
fits comfortably under the 10 RPM cap, so back-to-back forced re-runs
won't silently 429 the way they did with CHUNKS=8. Daily budget covers
~30 successful runs — well within the hourly cron schedule because the
doc-hash gate skips Gemini entirely on hours when the doc hasn't changed.
If you change CHUNKS or the doc edit cadence, recheck this math.