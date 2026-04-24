# ingest-reviews

Fetches the public community review Google Doc, parses it into sections by
heading, runs each changed section through Gemini 2.5 Flash to produce an
English summary, and upserts results into `course_reviews` and
`course_professor_reviews`.

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

`.env.local` should contain `GEMINI_API_KEY`, `REVIEW_DOC_ID`, and your
local Supabase URL / service role key.

## Deploy

```bash
supabase functions deploy ingest-reviews
```

## Invocation modes

```bash
# normal run — hash-gated, only changed sections call Gemini
curl -X POST $URL/functions/v1/ingest-reviews \
  -H "Authorization: Bearer $SERVICE_ROLE"

# force re-summarize everything (e.g. after prompt changes)
curl -X POST $URL/functions/v1/ingest-reviews \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

## Scheduling

Migration `007_schedule_review_ingest.sql` installs a `pg_cron` job that fires
every hour at minute 7. It requires two one-time database settings:

```sql
alter database postgres
  set app.settings.edge_url = 'https://<project-ref>.supabase.co';
alter database postgres
  set app.settings.service_role_key = '<service-role-key>';
```

Check runs via `select * from cron.job_run_details order by start_time desc`
and `select * from review_ingest_runs order by started_at desc`.

## Heading conventions the parser expects

Either pattern works:

```
# CSCI-SHU 101 — Prof. Wang        (one heading per course+prof)
```

or

```
# CSCI-SHU 101                     (H1 = course)
## Prof. Wang                      (H2 = professor, inherits course)
```

Headings mentioning `SHU` but lacking a parseable course code land in
`review_ingest_runs.unknown_course_codes` for the run, so maintainers can spot
and fix malformed headings.
