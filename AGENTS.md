# NYU Shanghai Course Planner — Agent Guide

Read this file before starting any task. Update it as part of every change (see Workflow).

## Overview

A course planning tool for NYU Shanghai students, live at [nyushplanner.app](https://nyushplanner.app). Students pick a major (plus an optional second major for double majors), add courses into 8 semester slots (4 years), and track progress toward 128 graduation credits and requirement fulfillment. Plans sync to the cloud for signed-in users; `localStorage` acts as a write-through cache.

**Tech stack:** React 19, Vite 8, Tailwind CSS 4 · Clerk (OAuth) + Supabase (Postgres, RLS) · Node built-in test runner.

## Repository Map

```
src/
  App.jsx                 Top-level state wiring (modals, auth, plan, catalog)
  App.css                 Component styles that go beyond Tailwind utilities
  main.jsx                Entry; wraps app in <ClerkProvider>
  components/
    auth/AuthGate.jsx     Clerk hosted sign-in redirect
    layout/               Header, PlanMenu (import/export), RequirementsSidebar,
                          SuggestionModal (feedback form), SuggestionInbox (admin)
    planner/              SemesterGrid → SemesterCard → CourseCard,
                          CoursePicker, CourseDetailModal, StudyAwayPicker
    reviews/ReviewSummary.jsx
    supporters/            SupporterBadge (wall/profile badge), SupportThanksToast
                          (post-checkout name/opt-in), SupportersView (donate + wall)
  hooks/
    useAuth.js            Bridge over Clerk's useAuth/useClerk/useUser
    useCatalog.js         Remote catalog fetch, paging, indexing
    usePlanner.js         Plan state, persistence, derived credits/progress,
                          major + secondMajor
    useCourseReviews.js   Review fetch per course
    useSupporter.js       Signed-in user's supporter status + wall profile save
    useTheme.js           Dark/light theme toggle
  lib/
    campus.js             Campus normalization/display helpers (+ tests)
    courseSearch.js       Course-picker aliases and match-quality ranking (+ tests)
    localCatalog.js       Local/generated catalog merge & fulfillment normalization (+ tests)
    majorCourseRules.js   Active-major(s) effective category resolution (+ tests)
    planStorage.js        localStorage + Supabase storage abstraction
    planSyncError.js      User-visible Supabase save error formatting (+ tests)
    planTransfer.js       Thin re-export barrel for planTransfer/* (+ tests)
    planTransfer/         CSV (csv.js), PDF (pdf.js), legacy-JSON (json.js)
                          export/import; shared.js holds common helpers; index.js re-exports
    prerequisites.js      Prerequisite parsing and unmet-prereq detection (+ tests)
    supabase.js           Supabase client init, getSupabaseClientWithAuth()
    feedbackAdmin.js      Admin visibility for the feedback inbox
    supporters.js         Supporter status read, public wall read, wall profile RPC (+ tests)
    payments/gumroad.js   Pure Gumroad checkout/ping/validation helpers (+ tests);
                          shared by the browser and the Deno gumroad-ping edge function
    payments/provider.js  Provider seam: getCheckoutUrl({ userId, productUrl }) wraps
                          buildGumroadCheckoutUrl; swap providers here later (+ tests)
  data/
    courses.js            Curated catalog, requirements, majors, study-away rules
    courses.generated.js  Generated bulletin fallback catalog (do not hand-edit)
    crossCampusOverrides.js  Manual merge/split overrides for the generator
scripts/
  scrape-bulletin.mjs            Crawls all 15 NYU bulletins → scraped-data/
  generate-local-catalog.mjs     scraped-data → src/data/courses.generated.js (+ tests)
  generate-major-requirements.mjs  One-off requirement extraction helper
  validate-scraped-data.mjs      Sanity checks on scraped JSON
  import-scraped-to-supabase.mjs Push scraped catalog into Supabase tables
  sync-local-credits.mjs         Reconcile local credit values
  ingest-reviews.mjs             Extract course/professor reviews from the community doc via Gemini → Supabase
  lib/                           Shared helpers: catalog/requirement normalize + review extract/providers (+ tests)
scraped-data/             Committed snapshots: all-courses.json, shanghai.json
supabase/
  migrations/             001–020 (numbered, append-only)
  functions/gumroad-ping/    Deno edge function: verifies Gumroad sale Pings via
                              the Gumroad API and records supporters via RPC (+ README)
  snippets/catchup_remote.sql  Catch-up for hosted DBs behind on migrations
.github/workflows/
  ingest-reviews.yml      Weekly cron + manual dispatch that runs scripts/ingest-reviews.mjs
docs/
  clerk-setup.md          Clerk dashboard/OAuth/domain setup walkthrough
```

**npm scripts:** `dev`, `build`, `preview`, `lint`, `test` (Node test runner over `src` + `scripts`), `generate:catalog`, `validate:catalog`, `import:catalog`, `sync-credits`, `ingest:reviews`.

## Architecture

### Plan state & persistence

The plan shape mirrors the Supabase schema so local and remote storage interchange cleanly:

```js
{
  id: 'local' | uuid,
  major: 'cs',
  secondMajor: 'economics' | null,
  studentName: 'Alice',
  semesters: { 'Y1-Fall': [{ courseId: 'CSCI-SHU-101', position: 0 }], ... }
}
```

Tables: `plans` (id, user_id text = Clerk ID, name, major, second_major, student_name) and `plan_courses` (plan_id FK, semester_id, course_id, custom_* fields, position). RLS policies check `auth.jwt()->>'sub' = user_id`. `src/lib/planStorage.js` abstracts localStorage vs Supabase; `usePlanner` picks the backend from auth state. After sign-in, Supabase is the source of truth and localStorage is a write-through cache.

Cloud saves expose `saving` / `synced` / `error` state from `usePlanner`. A failed Supabase save keeps the failed snapshot available for retry and shows a non-blocking warning below the header; the warning states that the latest changes are only cached locally and includes the Supabase message, code, details, and hint when present. A later successful save clears it.

### Double major

- `usePlanner` exposes `secondMajor` / `setSecondMajor` next to `major` / `setMajor`. `normalizeSecondMajor(secondMajor, primaryMajor)` in `src/data/courses.js` enforces the invariants (known major id, distinct from the primary, otherwise `null`); picking the second major as the new primary clears the second major.
- Persistence: localStorage payload field `secondMajor`; Supabase column `plans.second_major` (migration `018_add_second_major.sql`). The migration also extends `save_plan_with_courses` with `p_second_major` — `null` (stale clients that omit the param) preserves the stored value, `''` explicitly clears it. **Apply migration 018 before deploying the client**, since `planStorage` selects `second_major` explicitly.
- Requirement tracking: `requirementProgress['second-major']` mirrors the `major` entry and carries `doubleCountedCourses` (courses that are major courses for *both* majors). The sidebar renders a "2nd Major" section and a double-count note; NYU Shanghai allows at most `DOUBLE_MAJOR_MAX_DOUBLE_COUNT` (2) double-counted courses between majors, so the note turns into an amber warning beyond that.
- Free electives count only courses that are elective under the *combined* category; course cards, the picker, and the detail modal color by the combined category, so a course required by the second major shows as Major Required.
- Header UI: "+ 2nd major" ghost button (desktop) / "+" icon (mobile) reveals the second select; "×" removes it. Each major select excludes the other's current value.

### Catalog pipeline

1. `scripts/scrape-bulletin.mjs` crawls all 15 NYU undergraduate bulletins. Run without `--school` to refresh everything and rebuild `scraped-data/all-courses.json`. Single-school runs (`--school <slug>`) preserve the combined file; pass `--combine` to rebuild `all-courses.json` from per-school files without re-fetching.
2. `npm run generate:catalog` reads `scraped-data/all-courses.json`, aggregates duplicate course IDs across schools, and detects cross-campus equivalents by `(normalizedName, credits, subjectFamily)` — e.g. Data Structures taught as `CSCI-SHU-210` / `CSCI-UA-102` / `CS-UH-1050` collapses into one entry with `campuses: ["Shanghai", "New York", "Abu Dhabi"]` and an `equivalentCodes` map. Manual overrides live in `src/data/crossCampusOverrides.js` (`FORCE_EQUIVALENT` / `NOT_EQUIVALENT`). The script logs merge counts and flags suspicious merges (course numbers differing by ≥2 levels) for review.
3. At runtime, ownership is split: `src/lib/localCatalog.js` owns local merge/hydration, `src/hooks/useCatalog.js` owns remote fetch/indexing. Remote multi-campus offerings live in `public.catalog_course_offerings` (migration 017); `catalog_courses.id` remains the canonical stable ID used by saved plans.
4. Saved plans are refreshed via `mergeCourseWithLocalCatalog()` on load so courses pick up current metadata (requirement IDs, campus labels) without losing selected credits.

**Campus labels:** always go through `src/lib/campus.js` — `getCourseCampuses()` / `formatCourseCampuses()` instead of reading `course.campuses` directly. NYC-located bulletin schools group under the `New York` label. `compareCampuses()` orders Shanghai → New York → Abu Dhabi; `abbreviateCampus()` gives SH/NY/AD for compact UI.

**Categories:** `getEffectiveCategory(course, majorId)` in `src/lib/majorCourseRules.js` resolves the effective category (major-required, major-elective, …) for the active major. With a double major, use `getEffectiveCategoryForMajors(course, [major, secondMajor])` / `isCourseRelevantToMajors()` — the strongest category across the active majors wins (required > elective), falling back to the primary major's view. Requirement progress counts effective categories, not raw stored ones, so sidebar bars match course-card colors. Generated catalog fulfillment text is normalized in `localCatalog.js` (CORE Writing, Language, GPS/PoH/IPC/HPC/SSPC, Mathematics, Algorithmic Thinking, ED, STS → `requirementIds`).

**Major requirements (`MAJOR_REQUIREMENTS` in `src/data/courses.js`):** hand-curated, not regenerated — `scripts/generate-major-requirements.mjs` is stale (its `requirement-normalize.mjs` helper no longer exports the functions it imports) and the curated data carries fixes the generator does not (e.g. data-science/social-science `concentrations`). Each `selectOneCourses` group's `label` is a **display-only** string shown verbatim as a row in `RequirementsSidebar`; matching is done by `courseId`, never by label. Labels must describe the actual choice (e.g. `'Statistics Requirement'`, `'Principles of Macroeconomics or Economics of Global Business'`), not echo a bulletin section header like "Required Courses"/"Foundational Courses". Source of truth for the choices is the program `curriculum` in `scraped-data/shanghai.json` (a course with `alternatives` or a `Select N of the following` comment → a `selectOneCourses` group). Keep labels distinct within a major so duplicate rows don't appear.

### Review ingestion

- `scripts/ingest-reviews.mjs` (run by `.github/workflows/ingest-reviews.yml` — weekly cron + manual dispatch) extracts course and professor reviews from the freeform, bilingual community Google Doc and upserts `course_reviews` / `course_professor_reviews`. It replaced the deleted `ingest-reviews` edge function, whose ~150s budget forced lossy pruning that wrecked professor extraction.
- Pure helpers (slicing, prompt/schema, merge/dedupe, id-resolve, row-build) live in `scripts/lib/review-extract.mjs` (unit-tested); the model call is isolated in `scripts/lib/review-providers.mjs` with an injectable `fetch`. Default model `gemini-2.5-flash`, swappable via the `REVIEW_MODEL` env / repo variable (**Pro needs Google AI billing** — its free tier 429s).
- **Quota is the binding constraint:** this key's free tier is **20 requests/DAY per model** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, resets midnight US-Pacific = 07:00 UTC), and the doc is review-dense (100+ reviewed courses), so extraction runs as **continuation rounds**, not slices: each call sends the full doc + the not-yet-extracted catalog and asks for at most `REVIEW_COURSES_PER_CALL` courses in catalog order (default 30 for 2.5 models, 10 otherwise — small enough to never truncate), then `removeExtracted` shrinks the catalog and the next round continues, until a round returns empty (`MAX_ROUNDS` guard, plus a no-progress guard against id-less rounds). Every request yields data; none are wasted on truncated output. A truncated-empty round halves the cap adaptively (min 3); a mid-run quota 429 keeps the completed rounds and records the run as `partial:` in `review_ingest_runs.error` (gate stays open); **cross-run resume** skips courses already ingested for the current `doc_hash`, so successive runs converge on a quota-limited key instead of redoing the head; extracting zero rows overall is a hard failure (never logged as a clean run). The `workflow_dispatch` has a `force` checkbox (`REVIEW_FORCE=1`) to bypass the gate. Calls use **streaming** (`streamGenerateContent?alt=sse`, assembled by `parseSseResponse`) so long generations can't trip undici's ~300s socket timeout (which surfaces as `fetch failed`). `buildGeminiBody` is model-aware: thinking disabled only for the 2.5-flash family (2.0 rejects `thinkingConfig`; Pro can't disable), 65536 max output for 2.5 vs 8192 otherwise. Network errors retry; a min-interval throttle spaces rounds; a stream cut mid-generation (no `finishReason`, partial JSON) retries once then reports `MAX_TOKENS`; mid-stream `error` frames are surfaced (retriable 429/5xx retry, others throw) instead of being silently dropped.
- The FULL doc is sent on every call; the catalog is sliced round-robin only to bound model output (auto-bisect on `MAX_TOKENS`). One combined pass extracts a course with its professors nested, so prof→course attribution happens in a single reasoning step. Grounding quotes (verbatim, original-language) are stored in `raw_zh` and shown via the "Show original" toggle. SHA-256 gate on `review_ingest_runs.doc_hash` skips unchanged docs; migration `020` unscheduled the old pg_cron job. Env: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `REVIEW_DOC_ID` (GitHub repo secrets in CI).

### Auth (Clerk + Supabase RLS)

- Supabase validates Clerk session tokens via **Third-Party Auth**; RLS policies use `auth.jwt()->>'sub'` as the Clerk user ID. No webhook sync. Do not use the deprecated Clerk JWT template flow.
- Always call `getSupabaseClientWithAuth(getToken)` from `src/lib/supabase.js` before queries needing RLS — it wires the client's `accessToken` option to Clerk's `getToken()`.
- `AuthGate.jsx` renders `<RedirectToSignIn />` (Clerk Account Portal handles sign-in and sign-up; no in-app forms). `Header.jsx` uses Clerk's `<UserButton />` for avatar/sign-out/account management.
- Env: `VITE_CLERK_PUBLISHABLE_KEY` (pk_test for localhost, pk_live only on the production domain), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env` (git-ignored). Never commit the service-role key.
- Allowed email domains (`@nyu.edu`, `@nyu.edu.cn`) are configured in the Clerk dashboard. Full setup walkthrough: `docs/clerk-setup.md`.
- Migrations 010/011 moved RLS from Supabase Auth to Clerk JWTs and converted `plans.user_id` to text.

### Feedback / suggestions

- `SuggestionModal` submits to `public.suggestions` (migrations 012/013) via the authenticated client, falling back to a plain message insert if enrichment columns aren't deployed. Uses dedicated `suggestion-modal` / `suggestion-submit` styles in `App.css`.
- `SuggestionInbox` is the admin view (search, status/category filters, notes). Visibility is gated by `src/lib/feedbackAdmin.js` (`VITE_FEEDBACK_ADMIN_IDS` / `VITE_FEEDBACK_ADMIN_EMAILS`), but access is enforced by RLS: migration 014 creates `public.feedback_admins` — add an admin's Clerk user ID there to unlock the inbox.
- `App.jsx` owns `suggestionOpen` / `suggestionInboxOpen` and passes `getToken`, `user`, `plan`, `major`, `totalCredits` down (with a double major, the `major` string is combined, e.g. `cs + economics`).
- `supabase/snippets/catchup_remote.sql` brings hosted DBs missing migrations 012–014 up to date.

### Plan transfer

- UI exposes **CSV and PDF only**. JSON import/export helpers stay available for legacy compatibility and tests.
- `planTransfer.js` is a thin re-export barrel; the implementation lives under `planTransfer/` split by concern — `csv.js`, `pdf.js`, `json.js`, with shared helpers in `shared.js` and the public API re-exported from `index.js`. Import from `../../lib/planTransfer` (the export names are unchanged).
- `exportPlanAsPDF` builds a print document (summary header, credit progress, category/campus pills, study-away summary) then opens the browser print dialog. With a double major the PDF shows both major labels.
- CSV and legacy JSON include `campuses` so imported custom/remote-only courses keep their campus labels. JSON export/import round-trips `secondMajor`; CSV stays course-rows-only.

### Supporter donations

- **Free-tool-stays-free:** nothing in the planner is ever gated behind support. Supporter status only unlocks cosmetic perks (a badge, an optional name on the public wall) — every planning feature works identically for supporters and non-supporters.
- **Data (migration `019_supporters.sql`):** `supporter_payments` is the append-only ledger — primary key `(provider, provider_sale_id)` makes webhook writes idempotent on replay; it has RLS enabled with no policies, so only the service-role key (used by the edge function) can read or write it. `supporters` is the per-user profile — `display_name`, `is_public`, `lifetime_amount`, `first_supported_at`, keyed by Clerk `user_id`; RLS allows a user to read only their own row, and there are no client insert/update/delete policies (clients never write supporter rows directly). The `public_supporters` view projects just `display_name` + `first_supported_at` for rows with `is_public = true`, granted to `anon`/`authenticated`, and backs the opt-in wall. Two RPCs: `record_supporter_payment(provider, sale_id, user_id, amount, currency)` is the idempotent webhook writer (service_role only) — inserts the ledger row, and on a genuinely new sale upserts/increments the supporter's `lifetime_amount` without touching `display_name`/`is_public`; `update_supporter_profile(display_name, is_public)` is the caller-scoped wall-edit RPC (authenticated), updating only the signed-in user's existing `supporters` row.
- **Flow:** a signed-in user clicks a support action, which sends them to Gumroad's hosted checkout with their Clerk `user_id` carried in `url_params` (`buildGumroadCheckoutUrl` in `src/lib/payments/gumroad.js`). On purchase, Gumroad fires a Ping at the `gumroad-ping` edge function, which re-verifies the sale against the Gumroad API (Pings are unsigned) by checking `seller_id`/`product_id` (`isGumroadSaleValid`), then calls `record_supporter_payment` with the service-role key — so a badge can never be forged purely client-side. The client only ever reads its own `supporters` row (`getMySupporterStatus` in `src/lib/supporters.js`, via `useSupporter`) to show the badge; after returning from checkout with `?supported=1`, the `#supporters` view polls briefly for the new row to land.
- **Provider seam:** `src/lib/payments/provider.js` (`getCheckoutUrl({ userId, productUrl })`) wraps `gumroad.js` so the UI and edge function never depend on Gumroad specifics directly. Adding a second provider (Paddle, Stripe, …) later means a new builder in `payments/`, a new edge function mirroring `gumroad-ping`, and a `record_supporter_payment` call with that provider's name — the `supporters`/`supporter_payments` schema and the UI are provider-agnostic already.
- **China rail:** Gumroad doesn't support Alipay/WeChat Pay, so the `#supporters` view also shows a manual Alipay/WeChat QR code. Those donations are recorded by hand via `select public.record_supporter_payment('manual', '<ref>', '<clerk_user_id>', <amount_cents>, 'cny');` — no webhook involved.
- **Secrets vs public:** `GUMROAD_SELLER_ID`, `GUMROAD_PRODUCT_ID`, and `GUMROAD_ACCESS_TOKEN` are edge-function secrets only (set via `supabase secrets set`), used by `gumroad-ping` to call the Gumroad API and to validate Pings. The only payments-related value exposed to the browser is `VITE_GUMROAD_PRODUCT_URL` (the public Gumroad product page used to build the checkout link).
- **Feature flag / hidden until configured:** `VITE_GUMROAD_PRODUCT_URL` doubles as the on/off switch. While it is unset, `supportersEnabled` is `false` in `App.jsx`, so every supporter entry point — the `Support ✦` user-menu action, the footer link, the `#supporters` view, and the badge — is hidden, and `useSupporter` skips its fetch (so it never queries a not-yet-migrated `supporters` table). Setting the env var at launch reveals the whole feature; there is no separate flag to flip.
- **Rollout discipline:** apply migration 019 and deploy `gumroad-ping` *before* shipping the client code that reads `public_supporters` or calls `update_supporter_profile` — same ordering as migrations 015/018.

## UI Conventions

- Functional components only; hooks for all state logic. Named exports for hooks, default exports for components. One component per file.
- Tailwind for styling; `App.css` holds the styles that outgrow utilities.
- **Mobile breakpoint:** `lg:` (1024px) separates phone/tablet (single column + bottom sheet) from desktop (board + sidebar). The Header keeps TWO separate DOM layouts (mobile 2-row, desktop 1-row) — don't unify them via responsive classes; it clobbers `useRef`s. The requirements panel is a bottom sheet on mobile with a floating "Progress" pill.
- **Course picker:** already-added courses stay visible with an inline remove button (`getCourseSemester(courseId)` + `removeCourse(semesterId, courseId)` from `usePlanner`). Rows show campus labels and a campus filter; custom course campus defaults to the semester's study-away site, else Shanghai.
- **Course search:** exact and prefix matches rank before substring matches. Core aliases `poh` and `gps` surface WRIT-SHU 201 and CCSF-SHU 101L respectively without changing either course's requirement metadata.
- **CourseCard:** one pill per campus for multi-campus courses, using `abbreviateCampus()` short labels when ≥2 campuses; the `MapPin` icon renders once on the leading pill.
- **StudyAwayPicker:** desktop two-panel modal (summary metrics, semester rows, quick site chips, policy sidebar); on mobile it behaves as a bottom sheet with sticky actions. Preserve the status-first flow: pick semesters → resolve pending sites → review warnings. The CS/DS advisory (max 3 major courses per study-away semester, advising notes) triggers when *either* major is `cs` or `data-science`, and per-major `studyAwayNotes` from both majors are shown.

## Workflow (IMPORTANT)

- **Edit locally, do NOT create pull requests.** After finishing a task: `git add`, `git commit`, `git push` to the current branch — then stop. Never run `gh pr create` unless explicitly asked in the same message.
- **No `Co-Authored-By` trailers** in commit messages. Commit as `Duman <da3762@nyu.edu>`.
- **Update this file with every change**, in the same commit: new files/hooks/libs → Repository Map; architecture or schema changes → Architecture; new conventions → UI Conventions; removed features → delete stale references.
- Verify before committing: `npm run lint` and `npm test`.

## Open Work

- Guest mode: let unauthenticated users plan locally and import on first sign-in (`AuthGate` currently gates the whole app).
- Multiple saved plans per user with a header switcher.
