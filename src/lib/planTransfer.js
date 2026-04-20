import { COURSE_CATALOG, SEMESTERS, STUDY_AWAY } from "../data/courses";

const PLAN_EXPORT_VERSION = 1;
const PLAN_EXPORT_KIND = "nyu-shanghai-course-plan";

const SEMESTER_IDS = new Set(SEMESTERS.map((s) => s.id));
const STUDY_AWAY_SEMESTER_IDS = new Set(STUDY_AWAY.eligibleSemesters);
const STUDY_AWAY_LOCATIONS = new Set(STUDY_AWAY.locations);
const CATALOG_BY_ID = new Map(COURSE_CATALOG.map((c) => [c.id, c]));

function buildEmptyPlan() {
  const plan = {};
  SEMESTERS.forEach((s) => {
    plan[s.id] = [];
  });
  return plan;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function filenameBase(studentName) {
  const clean = (studentName || "").trim().replace(/[^\w]+/g, "_");
  return clean ? `${clean}-course-plan` : "course-plan";
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function normalizeStudyAwayPayload(studyAway) {
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

function resolveCourse(courseId, fallback) {
  const catalogCourse = CATALOG_BY_ID.get(courseId);
  if (catalogCourse) return catalogCourse;

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
  };
}

// ─── Export ───

export function exportPlanAsJSON({ plan, major, studentName, studyAway }) {
  const payload = {
    kind: PLAN_EXPORT_KIND,
    version: PLAN_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    major: major || "cs",
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
        })),
      ]),
    ),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${filenameBase(studentName)}-${timestampSlug()}.json`);
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportPlanAsCSV({ plan, studentName }) {
  const headers = [
    "Semester",
    "Code",
    "Name",
    "Credits",
    "Category",
    "CourseId",
  ];
  const lines = [headers.join(",")];
  for (const s of SEMESTERS) {
    for (const c of plan?.[s.id] || []) {
      lines.push(
        [s.id, c.code, c.name, c.credits, c.category, c.id]
          .map(csvCell)
          .join(","),
      );
    }
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, `${filenameBase(studentName)}-${timestampSlug()}.csv`);
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

export function exportPlanAsPDF({
  plan,
  major,
  studentName,
  studyAway,
  totalCredits,
  semesterCredits,
}) {
  const studyAwayLines = (studyAway?.selectedSemesters || [])
    .map((id) => {
      const label = SEMESTERS.find((s) => s.id === id)?.label || id;
      const loc = studyAway?.locations?.[id] || "—";
      return `<li>${escapeHtml(label)}: ${escapeHtml(loc)}</li>`;
    })
    .join("");

  const sections = SEMESTERS.map((s) => {
    const courses = plan?.[s.id] || [];
    const credits =
      semesterCredits?.[s.id] ??
      courses.reduce((acc, c) => acc + (c.credits || 0), 0);

    const rows = courses.length
      ? courses
          .map(
            (c) => `<tr>
              <td>${escapeHtml(c.code)}</td>
              <td>${escapeHtml(c.name)}</td>
              <td class="num">${escapeHtml(c.credits)}</td>
              <td>${escapeHtml(c.category)}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="muted">No courses</td></tr>`;

    return `
      <section class="semester">
        <h2>${escapeHtml(s.label)} <span class="credits">${credits} credits</span></h2>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Credits</th><th>Category</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }).join("");

  const title = `Course Plan${studentName ? ` — ${escapeHtml(studentName)}` : ""}`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  body { font: 12px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #555; margin-bottom: 16px; font-size: 12px; }
  .meta span + span::before { content: ' · '; }
  .semester { break-inside: avoid; page-break-inside: avoid; margin-bottom: 18px; }
  .semester h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin: 0 0 6px; display: flex; justify-content: space-between; align-items: baseline; }
  .credits { font-weight: normal; color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  th { font-weight: 600; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #999; text-align: center; font-style: italic; }
  .studyaway { margin-top: 8px; }
  .studyaway h3 { font-size: 13px; margin: 0 0 4px; }
  .studyaway ul { margin: 0; padding-left: 18px; }
  @media print { body { margin: 16mm; } }
</style>
</head>
<body>
<h1>NYU Shanghai Course Plan${studentName ? ` — ${escapeHtml(studentName)}` : ""}</h1>
<div class="meta">
  <span>Major: ${escapeHtml(major || "")}</span>
  <span>Total credits: ${escapeHtml(totalCredits ?? "")}</span>
  <span>Exported: ${escapeHtml(new Date().toLocaleString())}</span>
</div>
${sections}
${
  studyAwayLines
    ? `<section class="studyaway"><h3>Study Away</h3><ul>${studyAwayLines}</ul></section>`
    : ""
}
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    throw new Error(
      "Popup blocked. Allow popups for this site to export as PDF.",
    );
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ─── Import ───

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
  for (const [semId, rawCourses] of Object.entries(semestersSrc)) {
    if (!SEMESTER_IDS.has(semId) || !Array.isArray(rawCourses)) continue;
    for (const raw of rawCourses) {
      const courseId = raw?.id;
      if (!courseId || seen.has(courseId)) continue;
      const course = resolveCourse(courseId, raw);
      if (!course) continue;
      plan[semId].push(course);
      seen.add(courseId);
    }
  }

  const major = typeof parsed.major === "string" ? parsed.major : "cs";
  const studentName =
    typeof parsed.studentName === "string" ? parsed.studentName : "";
  const studyAway = normalizeStudyAwayPayload(parsed.studyAway);

  return { plan, major, studentName, studyAway };
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

  const header = parseCSVLine(rawLines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    semester: header.indexOf("semester"),
    code: header.indexOf("code"),
    name: header.indexOf("name"),
    credits: header.indexOf("credits"),
    category: header.indexOf("category"),
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

  for (let i = 1; i < rawLines.length; i++) {
    const cols = parseCSVLine(rawLines[i]);
    const semesterId = cols[idx.semester]?.trim();
    if (!SEMESTER_IDS.has(semesterId)) continue;

    const courseId =
      (idx.courseId >= 0 ? cols[idx.courseId]?.trim() : "") ||
      (idx.code >= 0 ? cols[idx.code]?.trim() : "");
    if (!courseId || seen.has(courseId)) continue;

    const fallback = {
      code: idx.code >= 0 ? cols[idx.code]?.trim() : undefined,
      name: idx.name >= 0 ? cols[idx.name]?.trim() : undefined,
      credits: idx.credits >= 0 ? cols[idx.credits]?.trim() : undefined,
      category: idx.category >= 0 ? cols[idx.category]?.trim() : undefined,
    };
    const course = resolveCourse(courseId, fallback);
    if (!course) continue;
    plan[semesterId].push(course);
    seen.add(courseId);
  }

  return { plan };
}
