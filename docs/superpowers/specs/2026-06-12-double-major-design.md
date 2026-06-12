# Double Major Setting — Design

Date: 2026-06-12
Status: Implemented

## Goal

Let a student declare an optional second major and have the planner treat
courses, requirement tracking, exports, and advisories as belonging to both
majors. Single-major users see no change.

## Approach

Additive `secondMajor` field (major id string or `null`) next to the existing
`major` string, rather than converting `major` into an array. Rationale:

- Backward compatible everywhere (old localStorage payloads, Supabase rows,
  and JSON exports simply lack the field → `null`).
- NYU Shanghai students declare at most two majors, so an array buys nothing.
- Avoids touching the meaning of the existing `plans.major` column and every
  `major` prop at once.

Alternatives considered: `majors: string[]` (more general, but forces a
migration of every persistence shape and export format for no real use case);
a separate "compare majors" view (doesn't track combined progress, which is
the point of declaring a double major).

## Data model & persistence

- `usePlanner`: `secondMajor` state + `setSecondMajor`. Normalization rules:
  must be a known major id, must differ from `major`, anything else → `null`.
  Changing the primary to the current second major clears the second major
  (the UI prevents this by filtering options; the guard covers imports).
- localStorage payload: adds `secondMajor`.
- Supabase: migration `018_add_second_major.sql`
  - `plans.second_major text` (nullable).
  - `save_plan_with_courses` gains `p_second_major text default null`. The old
    6-arg signature is dropped first so PostgREST doesn't see an ambiguous
    overload. Sentinel semantics: `null` (old clients) preserves the stored
    value; `''` (new clients with no second major) clears it. This prevents a
    stale deployed client from wiping a second major saved elsewhere.
  - `ensurePlan`/`load` select `second_major`; `importFromLocal` writes it.
  - **The migration must be applied before deploying the client**, because
    `load` selects the column explicitly (same rollout pattern as 002/015).
- JSON export/import: `secondMajor` round-trips. CSV is course-rows-only and
  unchanged. PDF export shows both major labels.

## Requirement logic

- `majorCourseRules.js` gains combined-major helpers:
  - `getEffectiveCategoryForMajors(course, majorIds)` — strongest category
    wins: `major-required` for either major → `major-required`, else
    `major-elective` for either → `major-elective`, else the primary major's
    effective category (which handles the "downgrade other majors' courses to
    elective" rule).
  - `isCourseRelevantToMajors(course, majorIds)` — relevant to any.
- `usePlanner.requirementProgress`:
  - `progress.major` — primary, unchanged shape.
  - `progress['second-major']` — same shape, computed against the second
    major, present only when one is set. Includes `doubleCountedCourses`
    (courses that are major courses for both) so the sidebar can surface
    NYU Shanghai's double-counting rule: **at most two courses may be
    double-counted between two majors** (per the NYU Shanghai academic
    bulletin / degree progress documentation).
  - Free electives = elective under the *combined* category.
  - Core requirement category matching uses the combined category (explicit
    `requirementIds` matches still win, as today).
- Study away: the CS/DS advisory now triggers if *either* major is CS or Data
  Science. This also fixes a dead check (`major === "ds"`) — the real id is
  `data-science`, so the DS advisory never fired before.

## UI

- **Header**: primary major select unchanged. When no second major: a ghost
  "+ 2nd major" button (desktop) / "+" icon (mobile) reveals a second select
  with a "Choose 2nd major…" placeholder. When set: second select plus an "×"
  remove button. Each select excludes the other's current value.
- **Requirements sidebar**: second "Major — X" section when set (shared
  section builder with the primary). Below it, a double-count line: "N
  course(s) double-count toward both majors", amber warning when N > 2 citing
  the two-course policy.
- **Course coloring** (cards, picker, detail modal): combined category, so a
  course required by the second major shows as Major Required.
- **Course picker**: relevance sorting and category filter use both majors.
- **Suggestion modal**: feedback payload's `major` becomes
  `"cs + economics"`-style combined string (no schema change).

## Testing

`node --test` on `src/lib` (the repo's existing pattern — no React test
infra): combined category precedence, relevance, and JSON import/export
round-trip incl. legacy payloads without `secondMajor`. UI verified via
`npm run build` + lint.
