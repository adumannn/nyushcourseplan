Keep looking to this file whenever I ask to do some tasks.


# NYU Shanghai Course Planner

## Project Overview

A course planning tool for NYU Shanghai students. React + Vite + Tailwind CSS v4. Students pick a major, drag/add courses into 8 semester slots (4 years), and track progress toward 128 graduation credits and requirement fulfillment.

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4
- **Data (MVP):** Local state + `localStorage` persistence
- **Data (Phase 2):** Supabase (auth, Postgres, row-level security)

---

## Phase 1 — MVP (Local-Only)

All data lives in `localStorage`. No backend, no accounts. Ship a fully working planner first.

### 1.1 Fix Existing Scaffolding

App.jsx references `useTheme`, `major`, `studentName`, `totalCredits`, `handleClearAll` — none are defined. Wire these up:

- [ ] Create `src/hooks/useTheme.js` — toggle light/dark, persist to `localStorage`
- [ ] Create `src/hooks/useCoursePlan.js` — manages the full plan state:
  - `plan`: object keyed by semester ID, each value is an array of course IDs
  - `major`, `studentName`
  - Derived: `totalCredits`, per-semester credits, requirement progress
  - Actions: `addCourse`, `removeCourse`, `moveCourse`, `setMajor`, `setStudentName`, `clearAll`
  - Persist entire plan to `localStorage` on every change
- [ ] Fix `App.jsx` to use these hooks and pass props correctly

### 1.2 Semester Grid

- [ ] Create `src/components/SemesterGrid.jsx` — renders 8 semester columns (or 2x4 grid on desktop)
- [ ] Create `src/components/SemesterCard.jsx` — one semester: title, list of courses, credit subtotal, drop target
- [ ] Create `src/components/CourseChip.jsx` — displays one course (code, name, credits) color-coded by category, with a remove button
- [ ] Credit subtotal per semester; warn if > 18 or < 12

### 1.3 Course Picker

- [ ] Create `src/components/CoursePicker.jsx` — sidebar/modal to browse `COURSE_CATALOG`
  - Filter by department, category, and major relevance
  - Search by name/code
  - Click or drag a course to add it to a semester
  - Already-placed courses shown as disabled

### 1.4 Requirements Tracker

- [ ] Create `src/components/RequirementsPanel.jsx` — shows progress for each `CORE_REQUIREMENTS` item + the selected major's requirements
  - Progress bars or checklist style
  - Green when fulfilled, amber when in-progress

### 1.5 Drag & Drop (optional for first pass)

- [ ] Use a lightweight DnD library (e.g., `@dnd-kit/core`) to reorder and move courses between semesters
- [ ] Can defer this — click-to-add is sufficient for MVP

### 1.6 Custom Course Entry

- [ ] Allow adding a custom course (name, credits, category) for courses not in the catalog
  - Store with `id: 'custom-<uuid>'`

---

## Phase 2 — Supabase Integration

Goal: users can sign in and their course plan persists across devices. The local-only MVP data model should map cleanly onto Supabase tables.

### 2.1 Supabase Setup

- [x] Create Supabase project
- [x] Install `@supabase/supabase-js`
- [x] Add `src/lib/supabase.js` — Supabase client init (reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env)
- [x] Env vars live in `.env` (already git-ignored). Keep the anon key there; never commit the service-role key.

### 2.2 Auth

- [x] **Clerk OAuth** (replaced Supabase Auth) — custom domain support on free tier
- [x] Clerk configuration — `VITE_CLERK_PUBLISHABLE_KEY` in `.env`, secret key for server-side functions
- [x] Google OAuth via Clerk — custom domain available on free tier (no $10/mo Supabase upgrade cost)
- [x] `src/hooks/useAuth.js` — bridge hook wrapping Clerk's `useAuth()`, exposes compatible interface (`user`, `loading`, `signOut`)
- [x] `src/components/auth/AuthGate.jsx` — uses Clerk's prebuilt `<SignIn />` component inside the app's explicit auth branch
- [x] Clerk JWT validation in Supabase RLS — `auth.jwt()->>'sub'` (Clerk user ID) replaces `auth.uid()` in all RLS policies
- [x] Supabase Third-Party Auth for Clerk — app uses Clerk session tokens via Supabase's `accessToken` client option; do not use the deprecated Clerk JWT template flow
- [x] Email domain restriction — configure in Clerk dashboard (allowed domains: `@nyu.edu`, `@nyu.edu.cn`)
- [x] `src/lib/supabase.js` — `getSupabaseClientWithAuth()` creates a Supabase client backed by Clerk's `getToken()` callback for RLS validation
- [x] `src/main.jsx` — wrapped app with `<ClerkProvider>` for app-wide Clerk context
- [x] Supabase RLS migration `010_migrate_to_clerk_jwt.sql` — updated all policies to validate Clerk JWTs instead of Supabase sessions
- [x] Supabase schema migration `011_clerk_user_ids_and_policies.sql` — converts `plans.user_id` to Clerk text IDs and recreates plan/review policies
- [ ] Guest mode: unauthenticated users can use the planner locally via `localStorage` and import on first sign-in (not yet wired; `AuthGate` currently gates the whole app).

### 2.3 Database Schema

```sql
-- Clerk users are identified by auth.jwt()->>'sub' (e.g. 'user_...').

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null default 'My Plan',
  major text not null default 'custom',
  student_name text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.plan_courses (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade not null,
  semester_id text not null,           -- e.g. 'Y1-Fall'
  course_id text not null,             -- matches COURSE_CATALOG id or 'custom-<uuid>'
  custom_name text,                    -- only for custom courses
  custom_credits int,                  -- only for custom courses
  custom_category text,                -- only for custom courses
  position int not null default 0,     -- ordering within semester
  created_at timestamptz default now()
);

-- Row-level security: users can only read/write their own data
alter table public.plans enable row level security;
alter table public.plan_courses enable row level security;

create policy "Users manage own plans"
  on public.plans for all to authenticated
  using (auth.jwt()->>'sub' = user_id)
  with check (auth.jwt()->>'sub' = user_id);

create policy "Users manage own plan courses"
  on public.plan_courses for all to authenticated
  using (plan_id in (select id from public.plans where user_id = auth.jwt()->>'sub'))
  with check (plan_id in (select id from public.plans where user_id = auth.jwt()->>'sub'));
```

### 2.4 Data Layer Swap

- [x] Create `src/lib/planStorage.js` with a unified interface:
  - `loadPlan(planId)` / `savePlan(plan)` / `deletePlan(planId)`
  - Two implementations: `localStoragePlan` (MVP) and `supabasePlan` (Phase 2)
  - `usePlanner` hook calls whichever backend is active based on auth state
- [ ] On first sign-in, offer to import the guest `localStorage` plan into Supabase
- [x] After sign-in, all plan reads/writes go to Supabase; `localStorage` becomes a write-through cache for offline resilience

### 2.5 Multiple Plans (stretch)

- [ ] Allow users to have multiple saved plans (e.g., "Plan A — CS", "Plan B — DS")
- [ ] Plan switcher in the header

---

## Architecture Notes

**Design the MVP state shape to match the Supabase schema.** The `useCoursePlan` hook should work with this shape from day one:

```js
{
  id: 'local' | uuid,
  major: 'cs',
  studentName: 'Alice',
  semesters: {
    'Y1-Fall': [{ courseId: 'CSCI-SHU-101', position: 0 }, ...],
    'Y1-Spring': [...],
    ...
  }
}
```

This maps directly to `plans` + `plan_courses` tables, making the Phase 2 swap minimal.

**File structure target:**

```
src/
  components/
    auth/
      AuthGate.jsx
    layout/
      Header.jsx
      PlanMenu.jsx
      RequirementsSidebar.jsx
      SuggestionInbox.jsx
      SuggestionModal.jsx
    planner/
      CourseCard.jsx
      CourseDetailModal.jsx
      CoursePicker.jsx
      SemesterCard.jsx
      SemesterGrid.jsx
      StudyAwayPicker.jsx
    reviews/
      ReviewSummary.jsx
  hooks/
    useTheme.js
    usePlanner.js
    useCatalog.js
    useCourseReviews.js
    useAuth.js           (Phase 2)
  lib/
    supabase.js          (Phase 2)
    planStorage.js       (Phase 2 — abstracts local vs remote)
    feedbackAdmin.js     (admin visibility helpers for the feedback inbox)
  data/
    courses.js           (exists)
  App.jsx
  main.jsx
```

## Conventions

- Functional components only, hooks for all state logic
- Tailwind for styling; no CSS files beyond what exists for any global resets
- All course data stays in `src/data/courses.js` — treat as the single source of truth for catalog
- Keep components small and focused; one component per file
- Use named exports for hooks, default exports for components

## Workflow (IMPORTANT)

- **Edit locally, do NOT create pull requests.** After finishing a task: `git add`, `git commit`, `git push` to the current branch — then stop. Never run `gh pr create` or invoke any /create-pr command unless the user explicitly asks in that same message.
- **No `Co-Authored-By` trailers** in commit messages.
- **Always update `AGENTS.md` after changes.** Before committing, review the change and update `AGENTS.md` to reflect any of the following that apply:
  - New files, components, hooks, or libs added → update the file structure section and any relevant checklist
  - Checklist items completed → mark them `[x]`
  - New conventions, patterns, or workflow rules established → add them under Conventions / Workflow / Durable Implementation Notes
  - Architecture or schema changes → update the Architecture Notes / schema sections
  - Removed or renamed features → remove or update stale references
  Treat the `AGENTS.md` update as part of the task itself, included in the same commit as the code change.

## Durable Implementation Notes

### Clerk + Supabase RLS integration

- **Clerk JWT in RLS policies:** Supabase validates Clerk session tokens through Third-Party Auth and policies use `auth.jwt()->>'sub'` as the Clerk user ID. No webhook sync is needed.
- **Custom domain support:** Clerk's free tier includes one custom OAuth redirect domain (e.g., `auth.yourplan.com`). Configure in Clerk Dashboard → Domains, then update Google OAuth / other providers' redirect URIs to match.
- **Environment setup:** `VITE_CLERK_PUBLISHABLE_KEY` goes in `.env` for client-side use; use a Clerk `pk_test_...` key for localhost development and a `pk_live_...` key only on the configured production domain. `CLERK_SECRET_KEY` is for server functions if needed later.
- **AuthGate uses Clerk's Account Portal:** `src/components/auth/AuthGate.jsx` renders `<RedirectToSignIn />` from `@clerk/react`, which sends unauthenticated users to Clerk's hosted sign-in/sign-up UI. With a custom domain configured (e.g. `accounts.nyushplanner.app`), the publishable key resolves the redirect to the custom domain automatically — no `signInUrl` / `signUpUrl` overrides needed on `<ClerkProvider>`. The Account Portal handles both flows (sign-in and sign-up) so the app no longer maintains separate `/sign-up` routing or in-app form components.
- **UserButton for avatar & profile:** `Header.jsx` uses Clerk's built-in `<UserButton />` component (from `@clerk/react`) instead of a custom `AccountMenu`. This automatically shows the user's Google avatar, provides sign-out, and includes a "Manage account" panel where users can customise their avatar, name, and connected accounts. The `user`/`onSignOut` props are no longer passed to `Header`.
- **useAuth bridge:** `src/hooks/useAuth.js` wraps Clerk's `useAuth()`, `useClerk()`, and `useUser()` to expose a compatible interface for existing `App.jsx` code (`user`, `loading`, `getToken`, `signOut`).
- **getSupabaseClientWithAuth(getToken):** Always call this before making Supabase queries that need RLS validation. It creates a Supabase client with the `accessToken` option wired to Clerk's `getToken()` session-token callback.
- **Migration 010/011:** Migration 010 replaces Supabase Auth checks with Clerk JWT checks; migration 011 converts `plans.user_id` from UUID/FK to text and tightens plan/review policies for Clerk session tokens.

### Mobile UX patterns (see CLAUDE.md for full details)

- **Breakpoint for layout shift:** `lg:` (1024px) is the cutover between phone/tablet (single column with bottom sheet) and desktop (board + sidebar side-by-side).
- **Header has TWO independent layouts:** mobile 2-row vs. desktop 1-row; don't unify via responsive classes — keep both DOM instances separate to avoid `useRef` clobbering.
- **Requirements panel is a bottom sheet on mobile** with a floating "Progress" pill trigger.

### In-app suggestions

- **SuggestionModal** (`src/components/layout/SuggestionModal.jsx`) — retryable modal form with category dropdown, reply email, and textarea. Submits to `public.suggestions` table via authenticated Supabase client and falls back to a plain message insert if the enriched columns are not deployed yet. The modal uses dedicated `suggestion-modal` / `suggestion-submit` styling in `src/App.css` so feedback form spacing and disabled states can be tuned without changing the shared course picker modal.
- **Supabase table:** `public.suggestions` (migration `012_create_suggestions_table.sql`, enriched by `013_enrich_suggestions_for_triage.sql`) — base columns: `id`, `user_id` (auto-populated from Clerk JWT), `category`, `message`, `created_at`; triage columns: `contact_email`, `contact_name`, `page_path`, `plan_id`, `major`, `total_credits`, `user_agent`, `status`, `admin_notes`, `reviewed_at`. RLS allows insert + select for own rows only.
- **SuggestionInbox** (`src/components/layout/SuggestionInbox.jsx`) — admin-only inbox with search, status/category filters, status updates, and private notes. Header shows it only for admins configured by `src/lib/feedbackAdmin.js` (`VITE_FEEDBACK_ADMIN_IDS`, `VITE_FEEDBACK_ADMIN_EMAILS`, plus the default feedback email), but Supabase access is enforced by RLS.
- **Admin grants:** migration `014_feedback_admin_inbox_policies.sql` creates `public.feedback_admins` and admin read/update policies for `public.suggestions`. Add the admin's Clerk user ID to `public.feedback_admins` to unlock all suggestions in the inbox.
- **Remote catch-up:** `supabase/snippets/catchup_remote.sql` includes the suggestions table, enrichment columns, feedback admin table, and inbox policies for projects whose hosted Supabase database has not run migrations `012`/`013`/`014` yet.
- Header passes `onOpenSuggestion` and `onOpenSuggestionInbox` callbacks; `App.jsx` owns the `suggestionOpen` / `suggestionInboxOpen` state and passes `getToken`, `user`, `plan`, `major`, and `totalCredits` to the feedback components.

### Plan transfer exports

- **Visible export formats:** `PlanMenu` exposes CSV and PDF only. JSON import/export helpers remain in `src/lib/planTransfer.js` for legacy compatibility and tests, but JSON is not shown in the import/export UI.
- **PDF export:** `exportPlanAsPDF` generates a polished print document with a summary header, credit progress, category pills, semester credit status, and study-away summary before invoking the browser print dialog.

### Catalog architecture

- Catalog ownership is split cleanly: `src/lib/localCatalog.js` owns local merge/hydration logic, `src/hooks/useCatalog.js` owns remote fetch/indexing, and the old orphaned `src/lib/catalog.js` module has been removed to avoid duplicate sources of truth.
- Dynamic major-based categorization: `getEffectiveCategory(course, majorId)` in `src/lib/majorCourseRules.js` resolves the **effective** category (major-required, major-elective, etc.) based on the active major.
- Generated catalog fulfillment text is normalized in `src/lib/localCatalog.js`; `CORE STS` / “Science, Technology and Society” courses receive the `science` requirement ID so STS courses such as `SOCS-SHU-170` count in the requirements tracker.
- Saved plans are refreshed through `mergeCourseWithLocalCatalog()` on load so existing catalog courses pick up current metadata, including inferred requirement IDs, without losing selected credits.

### Course picker UX

- Already-added catalog courses stay visible in `CoursePicker` with an inline remove button. Use `getCourseSemester(courseId)` from `usePlanner` plus `removeCourse(semesterId, courseId)` to remove the existing placement without closing the picker.
