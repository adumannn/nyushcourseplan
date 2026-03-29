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

- [ ] Create Supabase project
- [ ] Install `@supabase/supabase-js`
- [ ] Add `src/lib/supabase.js` — Supabase client init (reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env)
- [ ] Add `.env.local` to `.gitignore` (store keys there)

### 2.2 Auth

- [ ] Supabase Auth with email/password (or magic link)
- [ ] Optional: Google OAuth for NYU email accounts
- [ ] Create `src/hooks/useAuth.js` — `user`, `signIn`, `signUp`, `signOut`, `loading`
- [ ] Create `src/components/AuthGate.jsx` — if not signed in, show sign-in form; if signed in, render the planner
- [ ] Unauthenticated users can still use the planner locally (guest mode using `localStorage`); signing in syncs their plan to the cloud

### 2.3 Database Schema

```sql
-- Users get an entry automatically via Supabase Auth (auth.users)

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
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
  on public.plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own plan courses"
  on public.plan_courses for all
  using (plan_id in (select id from public.plans where user_id = auth.uid()))
  with check (plan_id in (select id from public.plans where user_id = auth.uid()));
```

### 2.4 Data Layer Swap

- [ ] Create `src/lib/planStorage.js` with a unified interface:
  - `loadPlan(planId)` / `savePlan(plan)` / `deletePlan(planId)`
  - Two implementations: `localStoragePlan` (MVP) and `supabasePlan` (Phase 2)
  - `useCoursePlan` hook calls whichever backend is active based on auth state
- [ ] On first sign-in, offer to import the guest `localStorage` plan into Supabase
- [ ] After sign-in, all reads/writes go to Supabase; `localStorage` becomes a write-through cache for offline resilience

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
    Header.jsx          (exists)
    SemesterGrid.jsx
    SemesterCard.jsx
    CourseChip.jsx
    CoursePicker.jsx
    RequirementsPanel.jsx
    AuthGate.jsx         (Phase 2)
  hooks/
    useTheme.js
    useCoursePlan.js
    useAuth.js           (Phase 2)
  lib/
    supabase.js          (Phase 2)
    planStorage.js       (Phase 2 — abstracts local vs remote)
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