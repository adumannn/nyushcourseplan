import { SEMESTERS, STUDY_AWAY } from "../../data/courses.js";
import {
  LOCAL_CATALOG_BY_ID,
  mergeCourseWithLocalCatalog,
} from "../localCatalog.js";
import { getCourseCampuses } from "../campus.js";

export const SEMESTER_IDS = new Set(SEMESTERS.map((s) => s.id));
const STUDY_AWAY_SEMESTER_IDS = new Set(STUDY_AWAY.eligibleSemesters);
const STUDY_AWAY_LOCATIONS = new Set(STUDY_AWAY.locations);
export const CATALOG_BY_ID = LOCAL_CATALOG_BY_ID;

export function buildEmptyPlan() {
  const plan = {};
  SEMESTERS.forEach((s) => {
    plan[s.id] = [];
  });
  return plan;
}

export function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function filenameBase(studentName) {
  const clean = (studentName || "").trim().replace(/[^\w]+/g, "_");
  return clean ? `${clean}-course-plan` : "course-plan";
}

export function countCoursesInPlan(plan) {
  return Object.values(plan || {}).reduce(
    (sum, courses) => sum + (Array.isArray(courses) ? courses.length : 0),
    0,
  );
}

export function summarizePlan(plan) {
  const bySemester = {};
  let courseCount = 0;
  let customCourseCount = 0;

  for (const semester of SEMESTERS) {
    const courses = Array.isArray(plan?.[semester.id]) ? plan[semester.id] : [];
    bySemester[semester.id] = courses.length;
    courseCount += courses.length;
    customCourseCount += courses.filter((course) =>
      String(course?.id || "").startsWith("custom-"),
    ).length;
  }

  return {
    courseCount,
    customCourseCount,
    bySemester,
  };
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildImportWarnings(stats) {
  const warnings = [];

  if (stats.invalidSemesterRows > 0) {
    warnings.push(
      `Skipped ${pluralize(stats.invalidSemesterRows, "row")} with unknown semester IDs.`,
    );
  }

  if (stats.duplicateCourses > 0) {
    warnings.push(
      `Skipped ${pluralize(stats.duplicateCourses, "duplicate course")} already present in this file.`,
    );
  }

  if (stats.missingCourseIds > 0) {
    warnings.push(
      `Skipped ${pluralize(stats.missingCourseIds, "row")} without a course ID.`,
    );
  }

  if (stats.unknownCatalogCourses > 0) {
    const verb = stats.unknownCatalogCourses === 1 ? "was" : "were";
    warnings.push(
      `${pluralize(stats.unknownCatalogCourses, "course")} not found in the catalog ${verb} imported with fallback details.`,
    );
  }

  return warnings;
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function normalizeStudyAwayPayload(studyAway) {
  if (!studyAway || typeof studyAway !== "object") {
    return { selectedSemesters: [], locations: {} };
  }

  const rawSelected = Array.isArray(studyAway.selectedSemesters)
    ? studyAway.selectedSemesters
    : [];
  const selectedSemesters = rawSelected.filter((id) =>
    STUDY_AWAY_SEMESTER_IDS.has(id),
  );

  const locSrc =
    studyAway.locations && typeof studyAway.locations === "object"
      ? studyAway.locations
      : {};
  const locations = {};
  for (const id of selectedSemesters) {
    const loc = locSrc[id];
    locations[id] = STUDY_AWAY_LOCATIONS.has(loc) ? loc : "";
  }

  return { selectedSemesters, locations };
}

export function resolveCourse(courseId, fallback) {
  const catalogCourse = CATALOG_BY_ID.get(courseId);
  if (catalogCourse) {
    return mergeCourseWithLocalCatalog(fallback || {}, { courseId });
  }

  if (!courseId) return null;
  const rawCredits = fallback?.credits;
  const credits =
    typeof rawCredits === "number"
      ? rawCredits
      : Number.parseFloat(rawCredits);

  return {
    id: courseId,
    code: fallback?.code || courseId,
    name: fallback?.name || "Unknown Course",
    credits: Number.isFinite(credits) ? credits : 4,
    category: fallback?.category || "elective",
    department: fallback?.department || "Custom",
    campuses: getCourseCampuses(fallback),
  };
}
