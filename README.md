# NYU Shanghai Course Planner

A course planning tool for NYU Shanghai students. Plan your 4-year journey, pick a major, add courses into 8 semester slots, and track progress toward 128 graduation credits and requirement fulfillment.

**Live:** [nyushplanner.app](https://nyushplanner.app)

## Supported Majors

- Computer Science
- Business and Finance

## Features

- **8-semester grid** — Organize courses across 4 years (Fall & Spring)
- **Course catalog** — Browse 70+ NYU Shanghai courses, filter by department and category (Major Required, Major Elective, Core, etc.)
- **Custom courses** — Add courses not in the catalog
- **Requirements tracker** — Track core, major, writing, language, and elective progress with visual progress bars
- **Select-N progress** — Requirement groups like "Business Core Electives (select 2)" show "1/2 selected" progress
- **Prerequisite info** — Course cards display prerequisite requirements inline
- **Credit warnings** — Alerts when a semester exceeds 18 or falls below 12 credits
- **Category legend** — Color-coded legend in the sidebar explains what each course color means
- **Drag & drop** — Reorder and move courses between semesters (desktop and mobile touch support)
- **Study away planning** — Mark semesters as study away with location selection
- **Google sign-in** — Plans sync to the cloud across devices
- **Guest mode** — Use without an account (saved locally)
- **Dark/light theme** — System-aware with manual toggle

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4
- **Auth & Database:** Supabase (Google OAuth, Postgres, Row-Level Security)
- **Styling:** CSS custom properties with light/dark themes

## Use It

Visit **[nyushplanner.app](https://nyushplanner.app)** — no installation needed. Sign in with Google or use guest mode.

## License

This project is **source-available** — you can read the code to learn from it, but you may **not** copy, redistribute, or deploy it without permission. See [LICENSE](LICENSE) for details.

## Project Structure

```
src/
  components/
    AuthGate.jsx          Sign-in screen (Google + Guest)
    Header.jsx            Logo, credits, major select, user info
    SemesterGrid.jsx      4-year grid layout
    SemesterCard.jsx      Single semester with courses
    CourseCard.jsx         Individual course chip
    CoursePicker.jsx      Modal to browse/add courses
    RequirementsSidebar.jsx  Progress tracker
  hooks/
    useAuth.js            Google OAuth via Supabase
    usePlanner.js         Plan state, persistence, derived data
    useTheme.js           Dark/light theme toggle
  lib/
    supabase.js           Supabase client init
    planStorage.js        localStorage + Supabase storage abstraction
  data/
    courses.js            Course catalog, requirements, majors
```