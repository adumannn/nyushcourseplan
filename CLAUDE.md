# CLAUDE.md — NYU Shanghai Course Planner

## Project Overview

A web-based course planning tool for NYU Shanghai students. Students organize courses into an 8-semester grid (4 years x 2 semesters), track progress toward 128 graduation credits, and monitor core/major/elective requirement fulfillment. Currently supports Computer Science major only. Live at **nyushplanner.app** (deployed via Vercel).

Key features: 8-semester drag-and-drop grid, 60+ course catalog, custom course creation, requirements tracker sidebar, credit warnings (max 18/semester), Google OAuth with cloud sync (Supabase), guest mode (localStorage), dark/light theme.

## Tech Stack

- **Framework**: React 19 (functional components, hooks only)
- **Build**: Vite 8
- **Language**: JavaScript (JSX) — some TypeScript in `src/lib/utils/`
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite` plugin) + CSS custom properties for theming + manual CSS in `App.css` / `index.css`
- **UI Libraries**: shadcn/ui, Headless UI, Base UI, Lucide React icons
- **Auth & Database**: Supabase (Google OAuth, Postgres with RLS)
- **Analytics**: Vercel Analytics
- **Font**: Geist Variable (`@fontsource-variable/geist`)

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build to /dist
npm run lint      # ESLint (flat config, JS/JSX only)
npm run preview   # Preview production build locally
```

No test framework is configured. No CI/CD pipeline exists.

## Project Structure

```
src/
├── App.jsx                  # Root component — wires auth, planner, and UI state
├── main.jsx                 # React DOM entry point
├── index.css                # Global Tailwind imports, CSS variables, animations
├── App.css                  # Modal and component-specific styles
├── components/
│   ├── AuthGate.jsx         # Sign-in screen (Google OAuth + guest mode)
│   ├── Header.jsx           # Top bar — logo, credits display, major select, user menu
│   ├── SemesterGrid.jsx     # Main 4-year grid layout with drag-and-drop handling
│   ├── SemesterCard.jsx     # Individual semester card with course list
│   ├── CourseCard.jsx       # Course chip with category color, drag source
│   ├── CoursePicker.jsx     # Modal for browsing/adding courses from catalog
│   ├── RequirementsSidebar.jsx  # Progress tracker sidebar (collapsible)
│   ├── YearCard.jsx         # Year wrapper grouping two semester cards
│   ├── CategoryBar.jsx      # Category filtering UI
│   └── application/         # Reusable application-level components (TypeScript)
├── hooks/
│   ├── useAuth.js           # Google OAuth + Supabase auth state
│   ├── usePlanner.js        # Central hook: plan CRUD, persistence, derived data
│   └── useTheme.js          # Dark/light theme toggle with system detection
├── lib/
│   ├── supabase.js          # Supabase client init (gracefully null if no env vars)
│   ├── planStorage.js       # localStorage + Supabase persistence abstraction
│   ├── utils.js             # cn() utility (clsx + tailwind-merge)
│   └── utils/cx.ts          # Extended tailwind-merge for custom variants
├── data/
│   └── courses.js           # Course catalog, categories, semesters, requirements, majors
└── assets/                  # Images (NYU logo)
```

Other top-level directories:
- `public/` — Static assets (favicon, icons)
- `supabase/` — Supabase config (`config.toml`) and database migrations

## Architecture & Key Patterns

### State Management

All state lives in three custom hooks, consumed in `App.jsx`:
- **`useAuth`** — user session, sign-in/sign-out methods, `enabled` flag
- **`usePlanner(user)`** — the core hook. Manages `plan` (object mapping semester IDs to course arrays), `major`, CRUD operations (`addCourse`, `removeCourse`, `moveCourse`), and derived data (`totalCredits`, `semesterCredits`, `requirementProgress`, `allPlannedCourses`)
- **`useTheme`** — theme preference with `prefers-color-scheme` detection

### Data Flow

1. On mount, `usePlanner` loads from Supabase (if authenticated) or localStorage (guest mode)
2. Changes to the plan trigger a **debounced save** (500ms) — always writes to localStorage as cache, plus Supabase if authenticated
3. Course catalog and requirements are static data in `src/data/courses.js`

### Persistence

- **Guest mode**: localStorage only (key: `nyu-shanghai-course-planner`)
- **Authenticated**: Supabase tables `plans` + `plan_courses` with Row-Level Security, localStorage as cache
- Custom courses have IDs prefixed with `custom-` and store extra fields (`custom_name`, `custom_credits`, `custom_category`)

### Drag-and-Drop

- Desktop: HTML5 drag events with custom MIME type `application/x-nyu-course`
- Mobile: Custom tap-and-hold implementation (no HTML5 drag on touch devices)
- Handled in `SemesterGrid.jsx` with `onMoveCourse` callback

### Routing

Single-page app — no router. The `CoursePicker` modal opens via `pickerSemester` state in `App.jsx`.

## Code Conventions

- **Components**: Functional React, default exports, PascalCase filenames (`.jsx`)
- **Hooks**: `use` prefix, default exports, camelCase filenames (`.js`)
- **Utilities**: Named exports, camelCase filenames
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Styling**: Tailwind utility classes first; custom CSS classes for modals and animations; CSS custom properties for theme colors (defined in `index.css`)
- **Imports**: Relative paths from component files (e.g., `'../hooks/useAuth'`); `@/` alias available (mapped to `src/`) but not widely used yet
- **Class merging**: Use `cn()` from `src/lib/utils.js` (wraps `clsx` + `tailwind-merge`)

### ESLint Rules

- Flat config (ESLint 9+) in `eslint.config.js`
- React Hooks and React Refresh plugins enabled
- `no-unused-vars` ignores variables matching `^[A-Z_]` (uppercase constants)

## Environment Variables

```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

Both are optional — if missing, Supabase is disabled and the app runs in guest-only mode (localStorage).

## Database

Supabase Postgres with two tables:
- **`plans`** — `id`, `user_id`, `major`, `student_name`, `created_at`
- **`plan_courses`** — `plan_id`, `semester_id`, `course_id`, `position`, `custom_name`, `custom_credits`, `custom_category`

Row-Level Security ensures users can only access their own data. Migration in `supabase/migrations/001_create_tables.sql`.

## Adding a New Major

1. Add entry to `MAJORS` array in `src/data/courses.js`
2. Define requirements in `MAJOR_REQUIREMENTS` (same file)
3. Tag courses with `majorRoles: { majorId: 'required' | 'elective' }`
4. The requirements tracker and sidebar will automatically pick up the new major

## Key Constants (in `src/data/courses.js`)

- `GRADUATION_CREDITS = 128`
- `MAX_CREDITS_PER_SEMESTER = 18`
- `MIN_CREDITS_PER_SEMESTER = 12`
- `CATEGORIES` — core, writing, language, gps, major, elective (with colors)
- `SEMESTERS` — 8 semesters with IDs like `Y1-Fall`, `Y2-Spring`, etc.
