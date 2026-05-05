#!/usr/bin/env node

/**
 * Generates src/data/courses.generated.js from scraped-data/all-courses.json so
 * the offline / local-fallback catalog covers all scraped undergraduate
 * bulletin courses instead of the hand-curated ~75-course CS-centric subset.
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

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import {
  compareCampuses,
  getCampusLabelForSchoolSlug,
  normalizeCampuses,
} from "../src/lib/campus.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const INPUT_PATH = join(PROJECT_ROOT, "scraped-data", "all-courses.json");
const OUTPUT_PATH = join(PROJECT_ROOT, "src", "data", "courses.generated.js");
const OVERRIDES_PATH = join(
  PROJECT_ROOT,
  "src",
  "data",
  "crossCampusOverrides.js",
);
const SHANGHAI_PRIORITY = 0;

// Subject prefix → family. Two prefixes that map to the same family are
// considered the same field (e.g., "CSCI" and "CS" are both computer science).
// Default for unmapped prefixes is the lowercased prefix itself.
const SUBJECT_FAMILY_MAP = new Map([
  ["CSCI", "cs"],
  ["CS", "cs"],
  ["MATH", "math"],
  ["ECON", "econ"],
  ["PHYS", "phys"],
  ["CHEM", "chem"],
  ["BIOL", "bio"],
  ["BIO", "bio"],
  ["PHIL", "phil"],
  ["PSYC", "psych"],
  ["SOCS", "soc"],
  ["SOC", "soc"],
  ["ANTH", "anth"],
  ["BUSN", "bus"],
  ["BUS", "bus"],
  ["ACCT", "acct"],
  ["FINC", "finc"],
  ["MKTG", "mktg"],
  ["MGMT", "mgmt"],
  ["ARTH", "arth"],
  ["MUSIC", "music"],
  ["MUS", "music"],
  ["FILM", "film"],
  ["JOUR", "jour"],
  ["NEUR", "neuro"],
  ["NEURL", "neuro"],
  ["WRIT", "writ"],
  ["WRTNG", "writ"],
]);

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

function campusPriority(campuses) {
  if (campuses.includes("Shanghai")) return SHANGHAI_PRIORITY;
  if (campuses.includes("Abu Dhabi")) return 1;
  if (campuses.includes("New York")) return 2;
  return 3;
}

function buildCourseEntry(rawCourse, departmentName, schoolSlug) {
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
    campuses: normalizeCampuses([getCampusLabelForSchoolSlug(schoolSlug)]),
  };

  return entry;
}

function normalizeScrapeSchools(scrape) {
  if (scrape?.courses && typeof scrape.courses === "object") {
    return [["shanghai", scrape]];
  }

  return Object.entries(scrape || {}).filter(
    ([, schoolData]) => schoolData?.courses && typeof schoolData.courses === "object",
  );
}

function mergeCourseEntry(existing, next) {
  if (!existing) return next;

  const campuses = normalizeCampuses([
    ...normalizeCampuses(existing.campuses),
    ...normalizeCampuses(next.campuses),
  ]);
  const existingPriority = campusPriority(normalizeCampuses(existing.campuses));
  const nextPriority = campusPriority(normalizeCampuses(next.campuses));
  const base = nextPriority < existingPriority ? next : existing;

  return {
    ...base,
    campuses,
  };
}

function getSubjectPrefix(id) {
  const m = String(id || "").match(/^([A-Z]+)-/);
  return m ? m[1] : "";
}

function getSubjectFamily(id) {
  const prefix = getSubjectPrefix(id);
  if (!prefix) return "";
  return SUBJECT_FAMILY_MAP.get(prefix) || prefix.toLowerCase();
}

function normalizeNameForMatch(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function equivalenceKey(entry) {
  const family = getSubjectFamily(entry.id);
  if (!family) return null;
  const name = normalizeNameForMatch(entry.name);
  if (!name) return null;
  const credits = entry.credits;
  return `${family}|${name}|${credits}`;
}

class UnionFind {
  constructor() {
    this.parent = new Map();
  }
  ensure(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
  }
  find(x) {
    this.ensure(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
  groups() {
    const map = new Map();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!map.has(root)) map.set(root, []);
      map.get(root).push(id);
    }
    return Array.from(map.values());
  }
}

function pickCanonical(group) {
  // Prefer the campus with the lowest priority order (Shanghai > NY > AD).
  let best = group[0];
  for (const entry of group) {
    if (
      campusPriority(normalizeCampuses(entry.campuses)) <
      campusPriority(normalizeCampuses(best.campuses))
    ) {
      best = entry;
    }
  }
  return best;
}

function mergeEquivalentGroup(group) {
  const canonical = pickCanonical(group);
  const campuses = normalizeCampuses(
    group.flatMap((e) => normalizeCampuses(e.campuses)),
  ).sort(compareCampuses);

  const equivalentCodes = {};
  for (const entry of group) {
    if (entry.id === canonical.id) continue;
    for (const campus of normalizeCampuses(entry.campuses)) {
      if (!equivalentCodes[campus]) {
        equivalentCodes[campus] = entry.code || entry.id;
      }
    }
  }

  const merged = { ...canonical, campuses };
  if (Object.keys(equivalentCodes).length > 0) {
    merged.equivalentCodes = equivalentCodes;
  }
  return merged;
}

function buildEquivalenceGroups(entries, overrides) {
  const { FORCE_EQUIVALENT = [], NOT_EQUIVALENT = [] } = overrides || {};
  const idToEntry = new Map(entries.map((e) => [e.id, e]));

  // IDs that should never be auto-merged with siblings in their heuristic
  // group (force-split). Force-merge can still pull them together.
  const isolated = new Set();
  for (const list of NOT_EQUIVALENT) {
    if (Array.isArray(list)) for (const id of list) isolated.add(id);
  }

  // Step 1: group by heuristic key
  const heuristicGroups = new Map();
  for (const entry of entries) {
    const key = equivalenceKey(entry);
    if (!key) continue;
    if (!heuristicGroups.has(key)) heuristicGroups.set(key, []);
    heuristicGroups.get(key).push(entry);
  }

  // Step 2: union-find — heuristic merges (skip isolated IDs)
  const uf = new UnionFind();
  for (const entry of entries) uf.ensure(entry.id);

  for (const grp of heuristicGroups.values()) {
    if (grp.length < 2) continue;
    const participants = grp.filter((e) => !isolated.has(e.id));
    for (let i = 1; i < participants.length; i++) {
      uf.union(participants[0].id, participants[i].id);
    }
  }

  // Step 3: force-equivalent overrides (precedence over isolation)
  for (const list of FORCE_EQUIVALENT) {
    if (!Array.isArray(list) || list.length < 2) continue;
    for (let i = 1; i < list.length; i++) {
      if (idToEntry.has(list[0]) && idToEntry.has(list[i])) {
        uf.union(list[0], list[i]);
      }
    }
  }

  // Step 4: build groups, restricted to known IDs
  const ufGroups = uf.groups();
  const groupsOfEntries = ufGroups.map((ids) =>
    ids.map((id) => idToEntry.get(id)).filter(Boolean),
  );
  return groupsOfEntries;
}

async function loadOverrides() {
  if (!existsSync(OVERRIDES_PATH)) {
    return { FORCE_EQUIVALENT: [], NOT_EQUIVALENT: [] };
  }
  const mod = await import(pathToFileURL(OVERRIDES_PATH).href);
  return {
    FORCE_EQUIVALENT: Array.isArray(mod.FORCE_EQUIVALENT)
      ? mod.FORCE_EQUIVALENT
      : [],
    NOT_EQUIVALENT: Array.isArray(mod.NOT_EQUIVALENT) ? mod.NOT_EQUIVALENT : [],
  };
}

function flagSuspiciousMerge(group) {
  // Suspicious if course numbers within the group differ by more than a level.
  // Course numbers vary in width across campuses (3 digits vs 4 digits), so
  // compare the leading digit only.
  const levels = group
    .map((e) => {
      const m = String(e.id || "").match(/-(\d+)/g);
      if (!m) return null;
      const last = m[m.length - 1].replace(/^-/, "");
      return Number(last.charAt(0));
    })
    .filter((n) => Number.isInteger(n));
  if (levels.length < 2) return false;
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return max - min >= 2;
}

export function buildCatalogFromScrape(scrape, overrides) {
  const schools = normalizeScrapeSchools(scrape);
  if (schools.length === 0) {
    throw new Error(
      "Unexpected scrape shape: expected all-courses data or { courses: { <slug>: ... } }",
    );
  }

  const byId = new Map();

  for (const [schoolSlug, schoolData] of schools) {
    const subjects = schoolData?.courses;
    if (!subjects || typeof subjects !== "object") {
      throw new Error(
        `Unexpected scrape shape for ${schoolSlug}: expected { courses: { <slug>: { name, courses: [] } } }`,
      );
    }

    for (const [subjectSlug, subjectData] of Object.entries(subjects)) {
      const departmentName = stripSubjectSuffix(
        subjectData?.name || subjectSlug,
      );
      const subjectCourses = Array.isArray(subjectData?.courses)
        ? subjectData.courses
        : [];

      for (const rawCourse of subjectCourses) {
        const entry = buildCourseEntry(rawCourse, departmentName, schoolSlug);
        if (!entry) continue;
        byId.set(entry.id, mergeCourseEntry(byId.get(entry.id), entry));
      }
    }
  }

  const rawEntries = Array.from(byId.values());

  const groups = buildEquivalenceGroups(rawEntries, overrides || {});

  const merged = [];
  let mergeCount = 0;
  let droppedCount = 0;
  const suspicious = [];
  for (const group of groups) {
    if (group.length === 0) continue;
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    // Confirm group spans multiple campuses; if not, keep entries separate.
    const campusSet = new Set();
    for (const e of group) for (const c of e.campuses) campusSet.add(c);
    if (campusSet.size < 2) {
      for (const e of group) merged.push(e);
      continue;
    }
    mergeCount += 1;
    droppedCount += group.length - 1;
    if (flagSuspiciousMerge(group)) {
      suspicious.push(group.map((e) => e.id));
    }
    merged.push(mergeEquivalentGroup(group));
  }

  if (mergeCount > 0) {
    console.log(
      `Equivalence merge: ${mergeCount} cross-campus group(s) collapsed, ${droppedCount} duplicate entr${droppedCount === 1 ? "y" : "ies"} folded.`,
    );
    if (suspicious.length > 0) {
      console.log(
        `  ${suspicious.length} suspicious merge(s) (course numbers differ by ≥2 levels) — review and add to NOT_EQUIVALENT if wrong:`,
      );
      for (const ids of suspicious.slice(0, 20)) {
        console.log(`    ${ids.join(", ")}`);
      }
      if (suspicious.length > 20) {
        console.log(`    …and ${suspicious.length - 20} more`);
      }
    }
  }

  merged.sort((a, b) => a.id.localeCompare(b.id));
  return merged;
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
// latest \`scraped-data/all-courses.json\` produced by \`scripts/scrape-bulletin.mjs\`.
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

async function main() {
  const scrapeRaw = readFileSync(INPUT_PATH, "utf8");
  const scrape = JSON.parse(scrapeRaw);
  const overrides = await loadOverrides();
  const entries = buildCatalogFromScrape(scrape, overrides);
  const output = formatCatalogModule(entries, "scraped-data/all-courses.json");
  writeFileSync(OUTPUT_PATH, output, "utf8");

  console.log(
    `Wrote ${entries.length} courses to ${OUTPUT_PATH.replace(`${PROJECT_ROOT}/`, "")}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
