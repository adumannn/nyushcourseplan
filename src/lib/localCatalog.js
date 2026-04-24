import { COURSE_CATALOG } from "../data/courses.js";
import { hydrateCoursePrerequisites } from "./prerequisites.js";

export const LOCAL_CATALOG_COURSES = COURSE_CATALOG.map((course) =>
  hydrateCoursePrerequisites({ ...course }),
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
