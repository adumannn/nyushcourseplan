import { SEMESTERS } from "../data/courses.js";

export const CAMPUS_LABELS = {
  shanghai: "Shanghai",
  "abu-dhabi": "Abu Dhabi",
  "new-york": "New York",
};

export const CAMPUS_ABBREV = {
  Shanghai: "SH",
  "New York": "NY",
  "Abu Dhabi": "AD",
};

const CAMPUS_ORDER = ["Shanghai", "New York", "Abu Dhabi"];

export function compareCampuses(a, b) {
  const ai = CAMPUS_ORDER.indexOf(a);
  const bi = CAMPUS_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return String(a).localeCompare(String(b));
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

export function abbreviateCampus(label) {
  return CAMPUS_ABBREV[label] || label;
}

const NEW_YORK_SCHOOL_SLUGS = new Set([
  "arts-science",
  "college-arts-science",
  "dentistry",
  "gallatin",
  "liberal-studies",
  "meyers",
  "professional-studies",
  "rory-meyers-nursing",
  "silver",
  "social-work",
  "stern",
  "steinhardt",
  "tandon",
  "tandon-engineering",
  "tisch",
  "wagner",
]);

const CANONICAL_LABELS_BY_KEY = new Map(
  ["Shanghai", "New York", "Abu Dhabi"].map((label) => [
    label.toLowerCase(),
    label,
  ]),
);

function titleizeSlug(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function getCampusLabelForSchoolSlug(schoolSlug) {
  const slug = String(schoolSlug || "").trim().toLowerCase();
  if (!slug) return "";

  if (slug.includes("shanghai")) return CAMPUS_LABELS.shanghai;
  if (slug.includes("abu-dhabi") || slug.includes("abudhabi")) {
    return CAMPUS_LABELS["abu-dhabi"];
  }
  if (slug === "new-york" || NEW_YORK_SCHOOL_SLUGS.has(slug)) {
    return CAMPUS_LABELS["new-york"];
  }

  return titleizeSlug(slug);
}

export function normalizeCampusLabel(value) {
  const label = String(value || "").trim();
  if (!label) return "";

  const canonical = CANONICAL_LABELS_BY_KEY.get(label.toLowerCase());
  return canonical || label;
}

export function normalizeCampuses(primary, fallback = []) {
  const source = Array.isArray(primary) && primary.length > 0
    ? primary
    : Array.isArray(fallback)
      ? fallback
      : fallback
        ? [fallback]
        : [];

  const seen = new Set();
  const campuses = [];

  for (const value of source) {
    const campus = normalizeCampusLabel(value);
    if (!campus || seen.has(campus.toLowerCase())) continue;
    seen.add(campus.toLowerCase());
    campuses.push(campus);
  }

  return campuses;
}

export function getCourseCampuses(course, fallback = ["Shanghai"]) {
  const direct = normalizeCampuses(course?.campuses);
  if (direct.length > 0) return direct;

  const campus = normalizeCampusLabel(course?.campus);
  if (campus) return [campus];

  const schoolSlug =
    course?.sourceSchoolSlug ||
    course?.source_school_slug ||
    course?.schoolSlug ||
    course?.school_slug ||
    course?.catalog_subjects?.school_slug;
  const sourceCampus = getCampusLabelForSchoolSlug(schoolSlug);
  if (sourceCampus) return [sourceCampus];

  return normalizeCampuses(fallback);
}

export function formatCourseCampuses(course, fallback = ["Shanghai"]) {
  const campuses = getCourseCampuses(course, fallback);
  return campuses.join(", ");
}

export function getDefaultCampusForSemester(semesterId, studyAway) {
  const selectedSemesters = Array.isArray(studyAway?.selectedSemesters)
    ? studyAway.selectedSemesters
    : [];
  if (selectedSemesters.includes(semesterId)) {
    const location = normalizeCampusLabel(studyAway?.locations?.[semesterId]);
    if (location) return location;
  }

  const semester = SEMESTERS.find((item) => item.id === semesterId);
  return normalizeCampusLabel(semester?.location) || "Shanghai";
}
