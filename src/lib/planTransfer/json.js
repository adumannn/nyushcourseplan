import { SEMESTERS, normalizeSecondMajor } from "../../data/courses.js";
import { getCourseCampuses } from "../campus.js";
import {
  SEMESTER_IDS,
  CATALOG_BY_ID,
  buildEmptyPlan,
  timestampSlug,
  filenameBase,
  countCoursesInPlan,
  summarizePlan,
  buildImportWarnings,
  triggerDownload,
  normalizeStudyAwayPayload,
  resolveCourse,
} from "./shared.js";

const PLAN_EXPORT_VERSION = 2;
const PLAN_EXPORT_KIND = "nyu-shanghai-course-plan";

export function exportPlanAsJSON({
  plan,
  major,
  secondMajor,
  studentName,
  studyAway,
}) {
  const filename = `${filenameBase(studentName)}-${timestampSlug()}.json`;
  const payload = {
    kind: PLAN_EXPORT_KIND,
    version: PLAN_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    major: major || "cs",
    secondMajor: normalizeSecondMajor(secondMajor, major),
    studentName: studentName || "",
    studyAway: normalizeStudyAwayPayload(studyAway),
    semesters: Object.fromEntries(
      SEMESTERS.map((s) => [
        s.id,
        (plan?.[s.id] || []).map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          credits: c.credits,
          category: c.category,
          campuses: getCourseCampuses(c),
        })),
      ]),
    ),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, filename);

  return {
    filename,
    courseCount: countCoursesInPlan(payload.semesters),
  };
}

export async function importPlanFromJSON(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("File does not contain a course plan.");
  }

  // Accept our export payload ({ semesters }) or a raw planner state ({ plan })
  const semestersSrc =
    parsed.semesters && typeof parsed.semesters === "object"
      ? parsed.semesters
      : parsed.plan && typeof parsed.plan === "object"
        ? parsed.plan
        : null;

  if (!semestersSrc) {
    throw new Error("File is missing a semesters/plan object.");
  }

  const plan = buildEmptyPlan();
  const seen = new Set();
  const stats = {
    invalidSemesterRows: 0,
    duplicateCourses: 0,
    missingCourseIds: 0,
    unknownCatalogCourses: 0,
  };

  for (const [semId, rawCourses] of Object.entries(semestersSrc)) {
    if (!Array.isArray(rawCourses)) continue;

    if (!SEMESTER_IDS.has(semId)) {
      stats.invalidSemesterRows += rawCourses.length;
      continue;
    }

    for (const raw of rawCourses) {
      const courseId =
        typeof raw?.id === "string"
          ? raw.id.trim()
          : typeof raw?.courseId === "string"
            ? raw.courseId.trim()
            : "";

      if (!courseId) {
        stats.missingCourseIds += 1;
        continue;
      }

      if (seen.has(courseId)) {
        stats.duplicateCourses += 1;
        continue;
      }

      const course = resolveCourse(courseId, raw);
      if (!course) continue;

      if (!CATALOG_BY_ID.has(courseId) && !courseId.startsWith("custom-")) {
        stats.unknownCatalogCourses += 1;
      }

      plan[semId].push(course);
      seen.add(courseId);
    }
  }

  const major = typeof parsed.major === "string" ? parsed.major : "cs";
  const secondMajor = normalizeSecondMajor(parsed.secondMajor, major);
  const studentName =
    typeof parsed.studentName === "string" ? parsed.studentName : "";
  const studyAway = normalizeStudyAwayPayload(parsed.studyAway);
  const summary = summarizePlan(plan);
  const warnings = buildImportWarnings(stats);

  return {
    plan,
    major,
    secondMajor,
    studentName,
    studyAway,
    summary,
    warnings,
  };
}
