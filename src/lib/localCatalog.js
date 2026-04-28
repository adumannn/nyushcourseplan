import { COURSE_CATALOG } from "../data/courses.js";
import { GENERATED_CATALOG } from "../data/courses.generated.js";
import { hydrateCoursePrerequisites } from "./prerequisites.js";

// Merge the auto-generated bulletin scrape (~922 courses, mostly bare metadata)
// with the hand-curated COURSE_CATALOG (~75 courses with rich metadata —
// csRole, majors, requirementIds, custom prerequisites, etc.).
//
// Strategy: scraped fields fill in the gaps (description, offeringText,
// department for non-CS subjects), and the hand-curated entry wins on every
// field it explicitly defines. This preserves all the metadata the app
// relies on for major-relevance/category resolution while still surfacing
// every course on the bulletin in the picker even when Supabase is empty.
function mergeCatalogs(generated, curated) {
  const byId = new Map();

  for (const course of generated) {
    if (course?.id) byId.set(course.id, { ...course });
  }

  for (const course of curated) {
    if (!course?.id) continue;
    const existing = byId.get(course.id);
    if (existing) {
      // Hand-curated keys win, but keep the scrape's enrichments
      // (description / offeringText / fulfillmentText) when not overridden.
      byId.set(course.id, { ...existing, ...course });
    } else {
      byId.set(course.id, { ...course });
    }
  }

  return Array.from(byId.values());
}

const CORE_REQUIREMENT_PATTERNS = [
  {
    id: "science",
    pattern:
      /\b(core\s+sts|science,\s*technology,?\s+and\s+society|science\s+technology\s+and\s+society)\b/i,
  },
];

function inferRequirementIds(course) {
  const fulfillmentText =
    typeof course?.fulfillmentText === "string" ? course.fulfillmentText : "";
  if (!fulfillmentText) return [];

  return CORE_REQUIREMENT_PATTERNS.filter(({ pattern }) =>
    pattern.test(fulfillmentText),
  ).map(({ id }) => id);
}

function normalizeRequirementIds(course) {
  const ids = new Set([
    ...(Array.isArray(course.requirementIds) ? course.requirementIds : []),
    ...inferRequirementIds(course),
  ]);

  return {
    ...course,
    requirementIds: [...ids],
  };
}

const MERGED_CATALOG = mergeCatalogs(GENERATED_CATALOG, COURSE_CATALOG);

export const LOCAL_CATALOG_COURSES = MERGED_CATALOG.map((course) =>
  hydrateCoursePrerequisites(normalizeRequirementIds({ ...course })),
);

export const LOCAL_CATALOG_BY_ID = new Map(
  LOCAL_CATALOG_COURSES.map((course) => [course.id, course]),
);

function resolvePreferredArray(primary, fallback) {
  if (Array.isArray(primary) && primary.length > 0) return primary;
  return Array.isArray(fallback) ? fallback : [];
}

export function mergeCourseWithLocalCatalog(
  course,
  { courseId, selectedCredits } = {},
) {
  const id = courseId || course?.id || "";
  const catalogCourse = LOCAL_CATALOG_BY_ID.get(id);
  const merged = {
    ...(catalogCourse || {}),
    ...(course && typeof course === "object" ? course : {}),
    id: id || catalogCourse?.id || "",
    code: course?.code || catalogCourse?.code || id,
    name: course?.name || catalogCourse?.name || "Untitled Course",
    credits: Number.isFinite(selectedCredits)
      ? selectedCredits
      : Number.isFinite(course?.credits)
        ? course.credits
        : catalogCourse?.credits,
    category: catalogCourse?.category || course?.category || "elective",
    department: course?.department || catalogCourse?.department || "General",
    requirementIds: resolvePreferredArray(
      catalogCourse?.requirementIds,
      course?.requirementIds,
    ),
    majors: resolvePreferredArray(catalogCourse?.majors, course?.majors),
  };

  return hydrateCoursePrerequisites(merged);
}
