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
  hooks/
    useAuth.js            Bridge over Clerk's useAuth/useClerk/useUser
    useCatalog.js         Remote catalog fetch, paging, indexing
    usePlanner.js         Plan state, persistence, derived credits/progress,
                          major + secondMajor
    useCourseReviews.js   Review fetch per course
    useTheme.js           Dark/light theme toggle
  lib/
    campus.js             Campus normalization/display helpers (+ tests)
    localCatalog.js       Local/generated catalog merge & fulfillment normalization (+ tests)
    majorCourseRules.js   Active-major(s) effective category resolution (+ tests)
    planStorage.js        localStorage + Supabase storage abstraction
    planTransfer.js       CSV/PDF export, CSV/legacy-JSON import (+ tests)
    prerequisites.js      Prerequisite parsing and unmet-prereq detection (+ tests)
    supabase.js           Supabase client init, getSupabaseClientWithAuth()
    feedbackAdmin.js      Admin visibility for the feedback inbox
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
  lib/                           Shared normalize helpers for the scripts above
scraped-data/             Committed snapshots: all-courses.json, shanghai.json
supabase/
  migrations/             001–018 (numbered, append-only)
  functions/ingest-reviews/  Deno edge function for review ingestion
  snippets/catchup_remote.sql  Catch-up for hosted DBs behind on migrations
docs/
  clerk-setup.md          Clerk dashboard/OAuth/domain setup walkthrough
```

**npm scripts:** `dev`, `build`, `preview`, `lint`, `test` (Node test runner over `src` + `scripts`), `generate:catalog`, `validate:catalog`, `import:catalog`, `sync-credits`.

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

- UI exposes **CSV and PDF only**. JSON import/export helpers stay in `planTransfer.js` for legacy compatibility and tests.
- `exportPlanAsPDF` builds a print document (summary header, credit progress, category/campus pills, study-away summary) then opens the browser print dialog. With a double major the PDF shows both major labels.
- CSV and legacy JSON include `campuses` so imported custom/remote-only courses keep their campus labels. JSON export/import round-trips `secondMajor`; CSV stays course-rows-only.

## UI Conventions

- Functional components only; hooks for all state logic. Named exports for hooks, default exports for components. One component per file.
- Tailwind for styling; `App.css` holds the styles that outgrow utilities.
- **Mobile breakpoint:** `lg:` (1024px) separates phone/tablet (single column + bottom sheet) from desktop (board + sidebar). The Header keeps TWO separate DOM layouts (mobile 2-row, desktop 1-row) — don't unify them via responsive classes; it clobbers `useRef`s. The requirements panel is a bottom sheet on mobile with a floating "Progress" pill.
- **Course picker:** already-added courses stay visible with an inline remove button (`getCourseSemester(courseId)` + `removeCourse(semesterId, courseId)` from `usePlanner`). Rows show campus labels and a campus filter; custom course campus defaults to the semester's study-away site, else Shanghai.
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
