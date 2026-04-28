# NYU Shanghai Course Planner
<img width="1497" height="867" alt="image" src="https://github.com/user-attachments/assets/01075a8f-50a0-4f3c-a5ab-aa6695ee4f03" />

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
- **Import / Export** — Save your plan as CSV (spreadsheet-friendly) or a polished PDF print view. Load a plan back from CSV.
- **Google sign-in** — NYU-domain accounts; plans sync to the cloud across devices
- **Dark/light theme** — System-aware with manual toggle
- **Large local fallback catalog** — Uses generated Shanghai bulletin data merged with curated metadata

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4
- **Auth & Database:** Supabase (email/password + Google OAuth, Postgres, Row-Level Security)
- **Storage:** Supabase for signed-in users, `localStorage` as a write-through cache

## Development

```bash
npm install
npm run dev
```

To regenerate the local fallback catalog from the latest Shanghai scrape:

```bash
npm run generate:catalog
```

## Use It

Visit **[nyushplanner.app](https://nyushplanner.app)**. Sign in with your NYU email (`@nyu.edu`).

## License

This project is licensed under the **PolyForm Noncommercial License 1.0.0** — you may read, study, and modify the code for noncommercial purposes, but you may **not** use it commercially or deploy your own hosted version. See [LICENSE](LICENSE) for the full terms.

## Project Structure

```
src/
  components/
    auth/
      AuthGate.jsx          Google sign-in gate
    layout/
      Header.jsx            Logo, credits, major select, study-away, plan menu, account
      PlanMenu.jsx          Import/Export dropdown (CSV, PDF)
      RequirementsSidebar.jsx
    planner/
      SemesterGrid.jsx      4-year grid layout
      SemesterCard.jsx      Single semester with courses
      CourseCard.jsx        Individual course chip
      CourseDetailModal.jsx Course details popover
      CoursePicker.jsx      Modal to browse/add courses
      StudyAwayPicker.jsx   Study-away semester + location picker
    reviews/
      ReviewSummary.jsx     Course/professor review summaries
  hooks/
    useAuth.js              Auth state + Google OAuth via Supabase
    useCatalog.js           Catalog loader / selector
    usePlanner.js           Plan state, persistence, derived data, replacePlan
    useTheme.js             Dark/light theme toggle
  lib/
    localCatalog.js         Local catalog merge/hydration helpers
    supabase.js             Supabase client init
    planStorage.js          localStorage + Supabase storage abstraction
    planTransfer.js         Import/export helpers (CSV, PDF, legacy JSON import)
  data/
    courses.js              Curated course metadata, requirements, majors, study-away rules
    courses.generated.js    Generated Shanghai bulletin catalog fallback
scripts/
  generate-local-catalog.mjs   Builds src/data/courses.generated.js
```
