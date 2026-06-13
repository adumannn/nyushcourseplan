import { SEMESTERS } from "../../data/courses.js";
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
  resolveCourse,
} from "./shared.js";

function csvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportPlanAsCSV({ plan, studentName }) {
  const filename = `${filenameBase(studentName)}-${timestampSlug()}.csv`;
  const headers = [
    "Semester",
    "Code",
    "Name",
    "Credits",
    "Category",
    "Campuses",
    "CourseId",
  ];
  const lines = [headers.join(",")];
  for (const s of SEMESTERS) {
    for (const c of plan?.[s.id] || []) {
      lines.push(
        [
          s.id,
          c.code,
          c.name,
          c.credits,
          c.category,
          getCourseCampuses(c).join("; "),
          c.id,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, filename);

  return {
    filename,
    courseCount: countCoursesInPlan(plan),
  };
}

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export async function importPlanFromCSV(file) {
  const text = await file.text();
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (rawLines.length === 0) throw new Error("CSV file is empty.");

  const header = parseCSVLine(rawLines[0].replace(/^\uFEFF/, "")).map((h) =>
    h.trim().toLowerCase(),
  );
  const idx = {
    semester: header.indexOf("semester"),
    code: header.indexOf("code"),
    name: header.indexOf("name"),
    credits: header.indexOf("credits"),
    category: header.indexOf("category"),
    campuses: header.indexOf("campuses"),
    courseId: header.indexOf("courseid"),
  };
  if (idx.semester < 0) {
    throw new Error('CSV is missing a "Semester" column.');
  }
  if (idx.courseId < 0 && idx.code < 0) {
    throw new Error('CSV needs a "CourseId" or "Code" column.');
  }

  const plan = buildEmptyPlan();
  const seen = new Set();
  const stats = {
    invalidSemesterRows: 0,
    duplicateCourses: 0,
    missingCourseIds: 0,
    unknownCatalogCourses: 0,
  };

  for (let i = 1; i < rawLines.length; i++) {
    const cols = parseCSVLine(rawLines[i]);
    const semesterId = cols[idx.semester]?.trim();
    if (!SEMESTER_IDS.has(semesterId)) {
      stats.invalidSemesterRows += 1;
      continue;
    }

    const courseId =
      (idx.courseId >= 0 ? cols[idx.courseId]?.trim() : "") ||
      (idx.code >= 0 ? cols[idx.code]?.trim() : "");
    if (!courseId) {
      stats.missingCourseIds += 1;
      continue;
    }

    if (seen.has(courseId)) {
      stats.duplicateCourses += 1;
      continue;
    }

    const fallback = {
      code: idx.code >= 0 ? cols[idx.code]?.trim() : undefined,
      name: idx.name >= 0 ? cols[idx.name]?.trim() : undefined,
      credits: idx.credits >= 0 ? cols[idx.credits]?.trim() : undefined,
      category: idx.category >= 0 ? cols[idx.category]?.trim() : undefined,
      campuses:
        idx.campuses >= 0
          ? cols[idx.campuses]
              ?.split(";")
              .map((value) => value.trim())
              .filter(Boolean)
          : undefined,
    };
    const course = resolveCourse(courseId, fallback);
    if (!course) continue;

    if (!CATALOG_BY_ID.has(courseId) && !courseId.startsWith("custom-")) {
      stats.unknownCatalogCourses += 1;
    }

    plan[semesterId].push(course);
    seen.add(courseId);
  }

  return {
    plan,
    summary: summarizePlan(plan),
    warnings: buildImportWarnings(stats),
  };
}
