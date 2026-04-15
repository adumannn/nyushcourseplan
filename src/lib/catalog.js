import { COURSE_CATALOG } from "../data/courses";

const LOCAL_COURSES = Array.isArray(COURSE_CATALOG) ? COURSE_CATALOG : [];

export const DEFAULT_CATALOG_CATEGORY = "elective";
export const DEFAULT_CATALOG_CREDITS = 4;

export function getLocalCatalogCourses() {
  return LOCAL_COURSES;
}

export function getLocalCatalogCourseMap() {
  return new Map(LOCAL_COURSES.map((course) => [course.id, course]));
}

export function normalizeCatalogSubject(subject) {
  if (!subject) return null;
  if (Array.isArray(subject)) {
    return subject[0] || null;
  }
  return typeof subject === "object" ? subject : null;
}

export function buildPrerequisiteMap(relationshipRows = []) {
  const map = new Map();

  for (const row of relationshipRows) {
    if (!row || row.relationship_type !== "prerequisite") continue;
    if (!row.course_id || !row.related_course_id) continue;

    const existing = map.get(row.course_id) || [];
    if (!existing.includes(row.related_course_id)) {
      existing.push(row.related_course_id);
      map.set(row.course_id, existing);
    }
  }

  return map;
}

export function createRuntimeCourseFromRemote(
  row,
  {
    localCourseMap = getLocalCatalogCourseMap(),
    prerequisiteMap = new Map(),
  } = {},
) {
  const local = localCourseMap.get(row?.id);
  const subject = normalizeCatalogSubject(row?.catalog_subjects);

  const creditsMin =
    typeof row?.credits_min === "number" ? row.credits_min : null;
  const creditsMax =
    typeof row?.credits_max === "number" ? row.credits_max : null;
  const credits =
    creditsMin ?? creditsMax ?? local?.credits ?? DEFAULT_CATALOG_CREDITS;

  return {
    id: row?.id || local?.id || "",
    code: row?.code || local?.code || row?.id || "",
    name: row?.name || local?.name || "Untitled Course",
    credits,
    creditsMin: creditsMin ?? credits,
    creditsMax: creditsMax ?? credits,
    isVariableCredit: Boolean(row?.is_variable_credit),
    category: local?.category || DEFAULT_CATALOG_CATEGORY,
    department:
      local?.department || subject?.name || subject?.code || "General",
    description: row?.description || local?.description || "",
    prerequisites:
      prerequisiteMap.get(row?.id) || local?.prerequisites || [],
    prerequisiteNote:
      row?.prerequisite_note || local?.prerequisiteNote || "",
    requirementIds: Array.isArray(local?.requirementIds)
      ? local.requirementIds
      : [],
    majors: Array.isArray(local?.majors) ? local.majors : [],
    offeringText: row?.offering_text || "",
    offeringTerms: Array.isArray(row?.offering_terms)
      ? row.offering_terms
      : [],
  };
}

export function mergeCatalogCourses(
  remoteCourseRows = [],
  relationshipRows = [],
  localCourses = LOCAL_COURSES,
) {
  const localCourseMap = new Map(
    (localCourses || []).map((course) => [course.id, course]),
  );
  const prerequisiteMap = buildPrerequisiteMap(relationshipRows);
  const merged = new Map();

  for (const row of remoteCourseRows || []) {
    const runtimeCourse = createRuntimeCourseFromRemote(row, {
      localCourseMap,
      prerequisiteMap,
    });
    if (runtimeCourse.id) {
      merged.set(runtimeCourse.id, runtimeCourse);
    }
  }

  for (const course of localCourses || []) {
    if (course?.id && !merged.has(course.id)) {
      merged.set(course.id, course);
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    const codeCompare = (a.code || "").localeCompare(b.code || "");
    if (codeCompare !== 0) return codeCompare;
    return (a.name || "").localeCompare(b.name || "");
  });
}

export function buildCatalogIndexes(courses = []) {
  const coursesById = new Map();
  const departmentSet = new Set();

  for (const course of courses || []) {
    if (course?.id) {
      coursesById.set(course.id, course);
    }
    if (course?.department) {
      departmentSet.add(course.department);
    }
  }

  return {
    coursesById,
    departments: Array.from(departmentSet).sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}
