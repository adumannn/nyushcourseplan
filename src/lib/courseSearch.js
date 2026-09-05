import { getEffectiveCategoryForMajors } from "./majorCourseRules.js";

const COURSE_ALIASES = {
  "CCSF-SHU-101L": ["gps"],
  "WRIT-SHU-201": ["poh"],
};

export function courseMatchesRequirement(course, filter, majorIds) {
  if (!filter) return true;
  if (filter.courseIds?.length) return filter.courseIds.includes(course.id);
  if (filter.requirementId) {
    return course.requirementIds?.includes(filter.requirementId) || false;
  }
  if (filter.category) {
    return getEffectiveCategoryForMajors(course, majorIds) === filter.category;
  }
  return true;
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getCourseSearchRank(course, search) {
  const query = normalizeSearchValue(search);
  if (!query) return 0;

  const values = [
    course.name,
    course.code,
    course.id,
    course.department,
    ...Object.values(course.equivalentCodes || {}),
    ...(COURSE_ALIASES[course.id] || []),
  ]
    .filter(Boolean)
    .map(normalizeSearchValue);

  if (values.includes(query)) return 0;
  if (values.some((value) => value.startsWith(query))) return 1;
  if (values.some((value) => value.includes(query))) return 2;
  const words = query.split(" ");
  if (words.every((word) => values.some((value) => value.includes(word)))) return 3;
  return null;
}
