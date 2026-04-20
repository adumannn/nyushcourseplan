# NYU Shanghai Course Planner

A course planning tool for NYU Shanghai students. Plan your 4-year journey, pick a major, add courses into 8 semester slots, and track progress toward 128 graduation credits and requirement fulfillment.

**Live:** [nyushplanner.app](https://nyushplanner.app)

## Supported Majors

Computer Science, Data Science, Business and Finance, Business and Marketing, Biology, Chemistry, Computer Systems Engineering, Economics, Electrical and Systems Engineering, Global China Studies, Honors Mathematics, Humanities, Interactive Media Arts, Interactive Media + Business, Mathematics, Neural Science, Physics, Self-Designed Honors, Social Science.

## Features

- **8-semester grid** — Organize courses across 4 years (Fall & Spring)
- **Course catalog** — Browse NYU Shanghai courses, filter by department and category (Major Required, Major Elective, Core, etc.)
- **Custom courses** — Add courses not in the catalog
- **Requirements tracker** — Track core, major, writing, language, and elective progress with visual progress bars
- **Select-N progress** — Requirement groups like "Business Core Electives (select 2)" show "1/2 selected" progress
- **Prerequisite warnings** — Course cards flag unmet prerequisites inline
- **Credit warnings** — Alerts when a semester exceeds 18 or falls below 12 credits
- **Category legend** — Color-coded legend in the sidebar explains what each course color means
- **Drag & drop** — Reorder and move courses between semesters (desktop and mobile touch support)
- **Study away planning** — Mark semesters as study away with location selection and CS/DS-specific advising warnings
- **Import / Export** — Save your plan as JSON (lossless), CSV (spreadsheet-friendly), or PDF (print view). Load a plan back from JSON or CSV.
- **Email + Google sign-in** — NYU-domain accounts; plans sync to the cloud across devices
- **Dark/light theme** — System-aware with manual toggle

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4
- **Auth & Database:** Supabase (email/password + Google OAuth, Postgres, Row-Level Security)
- **Storage:** Supabase for signed-in users, `localStorage` as a write-through cache

## Use It

Visit **[nyushplanner.app](https://nyushplanner.app)** — no installation needed. Sign in with your NYU email (`@nyu.edu`).

## License

This project is licensed under the **PolyForm Noncommercial License 1.0.0** — you may read, study, and modify the code for noncommercial purposes, but you may **not** use it commercially or deploy your own hosted version. See [LICENSE](LICENSE) for the full terms.

## Project Structure

```
src/
  components/
    AuthGate.jsx            Sign-in / sign-up screen (email + Google)
    Header.jsx              Logo, credits, major select, study-away, plan menu, account
    PlanMenu.jsx            Import/Export dropdown (JSON, CSV, PDF)
    SemesterGrid.jsx        4-year grid layout
    SemesterCard.jsx        Single semester with courses
    CourseCard.jsx          Individual course chip
    CourseDetailModal.jsx   Course details popover
    CoursePicker.jsx        Modal to browse/add courses
    StudyAwayPicker.jsx     Study-away semester + location picker
    RequirementsSidebar.jsx Progress tracker
  hooks/
    useAuth.js              Email/password + Google OAuth via Supabase
    useCatalog.js           Catalog loader / selector
    usePlanner.js           Plan state, persistence, derived data, replacePlan
    useTheme.js             Dark/light theme toggle
  lib/
    catalog.js              Catalog source helpers
    supabase.js             Supabase client init
    planStorage.js          localStorage + Supabase storage abstraction
    planTransfer.js         Import/export helpers (JSON, CSV, PDF)
  data/
    courses.js              Course catalog, requirements, majors, study-away rules
```
