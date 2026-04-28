#!/usr/bin/env node

/**
 * Generates src/data/courses.generated.js from scraped-data/shanghai.json so
 * the offline / local-fallback catalog covers the full bulletin (~900 courses)
 * instead of the hand-curated ~75-course CS-centric subset.
 *
 * The hand-curated COURSE_CATALOG in src/data/courses.js is preserved and
 * merged on top at runtime (see src/lib/localCatalog.js) so explicit metadata
 * — csRole, majors, requirementIds, custom prerequisites, etc. — keeps
 * winning over the scrape's defaults.
 *
 * Usage:
 *   node scripts/generate-local-catalog.mjs
 *   npm run generate:catalog
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const INPUT_PATH = join(PROJECT_ROOT, "scraped-data", "shanghai.json");
const OUTPUT_PATH = join(PROJECT_ROOT, "src", "data", "courses.generated.js");

function stripSubjectSuffix(name) {
  // "Physics (PHYS-SHU)" → "Physics"
  if (typeof name !== "string") return "General";
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim() || "General";
}

function resolveCredits(rawCredits) {
  if (typeof rawCredits === "number" && Number.isFinite(rawCredits)) {
    return { credits: rawCredits, creditsMin: rawCredits, creditsMax: rawCredits };
  }

  if (typeof rawCredits === "string" && rawCredits.includes("-")) {
    const [minRaw, maxRaw] = rawCredits.split("-").map((part) => part.trim());
    const min = Number.parseInt(minRaw, 10);
    const max = Number.parseInt(maxRaw, 10);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { credits: max, creditsMin: min, creditsMax: max };
    }
  }

  const parsed = Number.parseInt(String(rawCredits), 10);
  if (Number.isFinite(parsed)) {
    return { credits: parsed, creditsMin: parsed, creditsMax: parsed };
  }

  return { credits: 4, creditsMin: 4, creditsMax: 4 };
}

function normalizeCourseId(id) {
  if (typeof id !== "string") return "";
  return id.trim().replace(/\s+/g, "-").toUpperCase();
}

function buildCourseEntry(rawCourse, departmentName) {
  const id = normalizeCourseId(rawCourse.id || rawCourse.code);
  if (!id) return null;

  const code = (rawCourse.code || id).replace(/-/g, "-").trim();
  const name = (rawCourse.name || id).trim();
  const { credits, creditsMin, creditsMax } = resolveCredits(rawCourse.credits);
  const isVariableCredit = creditsMin !== creditsMax;

  const prerequisites = Array.isArray(rawCourse.prerequisiteIds)
    ? rawCourse.prerequisiteIds.map(normalizeCourseId).filter(Boolean)
    : [];

  const entry = {
    id,
    code,
    name,
    credits,
    creditsMin,
    creditsMax,
    isVariableCredit,
    // The scrape doesn't tell us which major a course belongs to; the
    // dynamic `getEffectiveCategory` in src/lib/majorCourseRules.js recasts
    // this based on the active major's MAJOR_REQUIREMENTS.
    category: "elective",
    department: departmentName,
    description: typeof rawCourse.description === "string"
      ? rawCourse.description
      : "",
    prerequisites,
    prerequisiteNote: typeof rawCourse.prerequisiteNote === "string"
      ? rawCourse.prerequisiteNote
      : "",
    offeringText: typeof rawCourse.typicallyOffered === "string"
      ? rawCourse.typicallyOffered
      : "",
    fulfillmentText: typeof rawCourse.fulfillment === "string"
      ? rawCourse.fulfillment
      : "",
  };

  return entry;
}

function buildCatalogFromScrape(scrape) {
  const subjects = scrape?.courses;
  if (!subjects || typeof subjects !== "object") {
    throw new Error(
      `Unexpected scrape shape: expected { courses: { <slug>: { name, courses: [] } } }`,
    );
  }

  const entries = [];
  const seen = new Set();

  for (const [subjectSlug, subjectData] of Object.entries(subjects)) {
    const departmentName = stripSubjectSuffix(subjectData?.name || subjectSlug);
    const subjectCourses = Array.isArray(subjectData?.courses)
      ? subjectData.courses
      : [];

    for (const rawCourse of subjectCourses) {
      const entry = buildCourseEntry(rawCourse, departmentName);
      if (!entry) continue;
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));
  return entries;
}

function formatCatalogModule(entries, source) {
  const generatedAt = new Date().toISOString();

  const banner = `// AUTO-GENERATED — DO NOT EDIT BY HAND.
//
// Source: ${source}
// Generated: ${generatedAt}
// Courses: ${entries.length}
//
// Run \`npm run generate:catalog\` (or
// \`node scripts/generate-local-catalog.mjs\`) to refresh this file from the
// latest \`scraped-data/shanghai.json\` produced by \`scripts/scrape-bulletin.mjs\`.
//
// The hand-curated COURSE_CATALOG in src/data/courses.js is merged on top
// of GENERATED_CATALOG at runtime by src/lib/localCatalog.js, so explicit
// metadata (csRole, majors, requirementIds, prerequisites, …) keeps winning
// over the scrape's defaults for whichever courses are also tracked there.

`;

  const body = `export const GENERATED_CATALOG = ${JSON.stringify(entries, null, 2)};
`;

  return banner + body;
}

function main() {
  const scrapeRaw = readFileSync(INPUT_PATH, "utf8");
  const scrape = JSON.parse(scrapeRaw);
  const entries = buildCatalogFromScrape(scrape);
  const output = formatCatalogModule(entries, "scraped-data/shanghai.json");
  writeFileSync(OUTPUT_PATH, output, "utf8");

  console.log(
    `Wrote ${entries.length} courses to ${OUTPUT_PATH.replace(`${PROJECT_ROOT}/`, "")}`,
  );
}

main();
