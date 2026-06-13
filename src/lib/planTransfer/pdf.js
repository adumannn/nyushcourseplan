import {
  SEMESTERS,
  CATEGORIES,
  GRADUATION_CREDITS,
  MAX_CREDITS_PER_SEMESTER,
  MIN_CREDITS_PER_SEMESTER,
  getMajorLabel,
  normalizeSecondMajor,
} from "../../data/courses.js";
import { formatCourseCampuses } from "../campus.js";
import { countCoursesInPlan, pluralize } from "./shared.js";

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

function formatCredits(value) {
  const credits = Number(value);
  if (!Number.isFinite(credits)) return "0";
  return Number.isInteger(credits) ? String(credits) : credits.toFixed(1);
}

function sumCredits(courses = []) {
  return courses.reduce((acc, course) => {
    const credits = Number(course?.credits);
    return acc + (Number.isFinite(credits) ? credits : 0);
  }, 0);
}

function titleizeCategory(category) {
  return String(category || "elective")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getCategoryMeta(category) {
  const key = category || "elective";
  const meta = CATEGORIES[key] || {};
  const color =
    typeof meta.color === "string" && /^#[0-9a-f]{6}$/i.test(meta.color)
      ? meta.color
      : "#546E7A";

  return {
    label: meta.label || titleizeCategory(key),
    color,
  };
}

function semesterCreditState(credits, courseCount) {
  if (courseCount === 0) {
    return { className: "is-empty", label: "Empty" };
  }

  if (credits > MAX_CREDITS_PER_SEMESTER) {
    return { className: "is-over", label: `Over ${MAX_CREDITS_PER_SEMESTER}` };
  }

  if (credits < MIN_CREDITS_PER_SEMESTER) {
    return { className: "is-under", label: `Under ${MIN_CREDITS_PER_SEMESTER}` };
  }

  return { className: "is-balanced", label: "Balanced" };
}

export function exportPlanAsPDF({
  plan,
  major,
  secondMajor,
  studentName,
  studyAway,
  totalCredits,
  semesterCredits,
}) {
  const selectedStudyAway = Array.isArray(studyAway?.selectedSemesters)
    ? studyAway.selectedSemesters
    : [];
  const selectedStudyAwaySet = new Set(selectedStudyAway);

  const semesters = SEMESTERS.map((semester) => {
    const courses = Array.isArray(plan?.[semester.id]) ? plan[semester.id] : [];
    const rawCredits = semesterCredits?.[semester.id];
    const credits = Number.isFinite(Number(rawCredits))
      ? Number(rawCredits)
      : sumCredits(courses);
    const state = semesterCreditState(credits, courses.length);
    const location =
      selectedStudyAwaySet.has(semester.id)
        ? studyAway?.locations?.[semester.id] || "Study Away"
        : semester.location || "Shanghai";

    return {
      ...semester,
      courses,
      credits,
      state,
      location,
    };
  });

  const computedTotalCredits = semesters.reduce(
    (acc, semester) => acc + semester.credits,
    0,
  );
  const resolvedTotalCredits = Number.isFinite(Number(totalCredits))
    ? Number(totalCredits)
    : computedTotalCredits;
  const courseCount = semesters.reduce(
    (acc, semester) => acc + semester.courses.length,
    0,
  );
  const filledSemesterCount = semesters.filter(
    (semester) => semester.courses.length > 0,
  ).length;
  const resolvedSecondMajor = normalizeSecondMajor(secondMajor, major);
  const majorLabel = resolvedSecondMajor
    ? `${getMajorLabel(major || "")} · ${getMajorLabel(resolvedSecondMajor)}`
    : getMajorLabel(major || "");
  const progressPercent = Math.max(
    0,
    Math.min(100, (resolvedTotalCredits / GRADUATION_CREDITS) * 100),
  );
  const exportedAt = new Date().toLocaleString();

  const studyAwayItems = selectedStudyAway
    .map((id) => {
      const label = SEMESTERS.find((s) => s.id === id)?.label || id;
      const loc = studyAway?.locations?.[id] || "Location pending";
      return `
        <div class="studyaway-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(loc)}</strong>
        </div>`;
    })
    .join("");

  const sections = semesters.map((semester) => {
    const rows = semester.courses.length
      ? semester.courses
          .map((course, index) => {
            const category = getCategoryMeta(course.category);
            return `<tr>
              <td class="sequence">${index + 1}</td>
              <td class="code">${escapeHtml(course.code || course.id)}</td>
              <td class="course-title">${escapeHtml(course.name)}</td>
              <td class="num">${escapeHtml(formatCredits(course.credits))}</td>
              <td>
                <span class="category-pill" style="--cat: ${escapeHtml(category.color)}">
                  ${escapeHtml(category.label)}
                </span>
              </td>
              <td class="campus">${escapeHtml(formatCourseCampuses(course))}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" class="muted">No courses planned</td></tr>`;

    return `
      <section class="semester ${semester.state.className}">
        <div class="semester-head">
          <div>
            <p>${escapeHtml(semester.location)}</p>
            <h2>${escapeHtml(semester.label)}</h2>
          </div>
          <div class="semester-credits">
            <strong>${escapeHtml(formatCredits(semester.credits))}</strong>
            <span>credits</span>
          </div>
        </div>
        <div class="semester-status">${escapeHtml(semester.state.label)}</div>
        <table>
          <thead>
            <tr>
              <th class="sequence">#</th>
              <th>Code</th>
              <th>Course</th>
              <th class="num">Cr</th>
              <th>Category</th>
              <th>Campus</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }).join("");

  const title = `Course Plan${studentName ? ` - ${escapeHtml(studentName)}` : ""}`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  html,
  body { margin: 0; padding: 0; }
  body {
    background: #eef0f5;
    color: #151821;
    font: 11px/1.42 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .report {
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px;
    background: #ffffff;
  }
  .hero {
    border-radius: 18px;
    background: linear-gradient(135deg, #1d092c 0%, #57068c 62%, #7a29b8 100%);
    color: #ffffff;
    padding: 24px;
    overflow: hidden;
  }
  .eyebrow {
    margin: 0 0 8px;
    color: rgba(255, 255, 255, 0.76);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0;
  }
  h1 {
    margin: 0;
    font-size: 28px;
    line-height: 1.05;
    font-weight: 800;
  }
  .hero-copy {
    max-width: 680px;
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.84);
    font-size: 12px;
  }
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-top: 20px;
  }
  .metric {
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.11);
    padding: 10px 12px;
    min-height: 66px;
  }
  .metric span {
    display: block;
    color: rgba(255, 255, 255, 0.72);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0;
  }
  .metric strong {
    display: block;
    margin-top: 4px;
    font-size: 19px;
    line-height: 1.1;
  }
  .metric small {
    display: block;
    margin-top: 3px;
    color: rgba(255, 255, 255, 0.68);
    font-size: 10px;
  }
  .progress {
    height: 7px;
    margin-top: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    overflow: hidden;
  }
  .progress-bar {
    height: 100%;
    width: ${progressPercent.toFixed(2)}%;
    border-radius: inherit;
    background: #ffffff;
  }
  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 16px;
    margin: 20px 0 10px;
  }
  .section-title h2 {
    margin: 0;
    font-size: 16px;
  }
  .section-title p {
    margin: 0;
    color: #687083;
    font-size: 10px;
  }
  .semester-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .semester {
    position: relative;
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
    border: 1px solid #e2e6ee;
    border-radius: 14px;
    background: #ffffff;
  }
  .semester::before {
    content: "";
    display: block;
    height: 4px;
    background: #57068c;
  }
  .semester.is-under::before { background: #f59e0b; }
  .semester.is-over::before { background: #dc2626; }
  .semester.is-empty::before { background: #b6bdc9; }
  .semester-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 12px 8px;
  }
  .semester-head p {
    margin: 0 0 3px;
    color: #687083;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0;
  }
  .semester-head h2 {
    margin: 0;
    color: #151821;
    font-size: 14px;
    line-height: 1.15;
  }
  .semester-credits {
    min-width: 54px;
    text-align: right;
  }
  .semester-credits strong {
    display: block;
    font-size: 18px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .semester-credits span {
    display: block;
    color: #687083;
    font-size: 9px;
    text-transform: uppercase;
  }
  .semester-status {
    display: inline-flex;
    margin: 0 12px 9px;
    border-radius: 999px;
    background: #f2f4f8;
    color: #596173;
    padding: 3px 8px;
    font-size: 9px;
    font-weight: 700;
  }
  .is-balanced .semester-status {
    background: #eaf7ef;
    color: #16703a;
  }
  .is-under .semester-status {
    background: #fff5df;
    color: #9a5b00;
  }
  .is-over .semester-status {
    background: #fee9e9;
    color: #a31919;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th,
  td {
    border-top: 1px solid #edf0f5;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    color: #70788a;
    font-size: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0;
  }
  td {
    color: #252a36;
    font-size: 10px;
  }
  .sequence { width: 24px; color: #8b93a3; }
  .code {
    width: 76px;
    color: #57068c;
    font-weight: 800;
    overflow-wrap: anywhere;
  }
  .course-title {
    width: auto;
    overflow-wrap: anywhere;
  }
  .num {
    width: 34px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .category-pill {
    display: inline-flex;
    max-width: 100%;
    border: 1px solid #d8dde8;
    border-color: color-mix(in srgb, var(--cat) 42%, #ffffff);
    border-radius: 999px;
    background: #f6f7fb;
    background: color-mix(in srgb, var(--cat) 10%, #ffffff);
    color: var(--cat);
    padding: 2px 6px;
    font-size: 8px;
    font-weight: 800;
    white-space: normal;
  }
  .campus {
    width: 74px;
    color: #596173;
    overflow-wrap: anywhere;
  }
  .muted {
    color: #9aa2b1;
    text-align: center;
    font-style: italic;
    padding: 14px 8px;
  }
  .studyaway {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 14px;
    border: 1px solid #dbe4f0;
    border-radius: 14px;
    background: #f7fbff;
    padding: 12px;
  }
  .studyaway h2 {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .studyaway-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .studyaway-item {
    border: 1px solid #d8e3f4;
    border-radius: 10px;
    background: #ffffff;
    padding: 8px 10px;
  }
  .studyaway-item span {
    display: block;
    color: #687083;
    font-size: 9px;
    font-weight: 700;
  }
  .studyaway-item strong {
    display: block;
    margin-top: 2px;
    color: #183152;
    font-size: 11px;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 16px;
    color: #7a8292;
    font-size: 9px;
  }
  @media print {
    body { background: #ffffff; }
    .report {
      max-width: none;
      padding: 0;
      background: #ffffff;
    }
    .hero { border-radius: 14px; }
    .semester-grid { gap: 9px; }
    .semester { border-radius: 11px; }
  }
  @media (max-width: 760px) {
    .report { padding: 14px; }
    .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .semester-grid,
    .studyaway-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <main class="report">
    <section class="hero">
      <p class="eyebrow">NYU Shanghai Course Planner</p>
      <h1>${studentName ? `${escapeHtml(studentName)}'s Course Plan` : "Course Plan"}</h1>
      <p class="hero-copy">
        ${escapeHtml(majorLabel)} with ${escapeHtml(pluralize(courseCount, "planned course"))}
        across ${escapeHtml(pluralize(filledSemesterCount, "active semester"))}.
      </p>
      <div class="metric-grid">
        <div class="metric">
          <span>Total credits</span>
          <strong>${escapeHtml(formatCredits(resolvedTotalCredits))}</strong>
          <small>of ${GRADUATION_CREDITS} required</small>
          <div class="progress" aria-hidden="true">
            <div class="progress-bar"></div>
          </div>
        </div>
        <div class="metric">
          <span>Courses</span>
          <strong>${escapeHtml(courseCount)}</strong>
          <small>scheduled in the plan</small>
        </div>
        <div class="metric">
          <span>Semesters</span>
          <strong>${escapeHtml(filledSemesterCount)}/8</strong>
          <small>with planned coursework</small>
        </div>
        <div class="metric">
          <span>Study away</span>
          <strong>${escapeHtml(selectedStudyAway.length)}</strong>
          <small>selected semester${selectedStudyAway.length === 1 ? "" : "s"}</small>
        </div>
      </div>
    </section>

    <div class="section-title">
      <h2>Semester Plan</h2>
      <p>Generated ${escapeHtml(exportedAt)}</p>
    </div>

    <div class="semester-grid">
      ${sections}
    </div>

    ${
      studyAwayItems
        ? `<section class="studyaway">
            <h2>Study Away</h2>
            <div class="studyaway-grid">${studyAwayItems}</div>
          </section>`
        : ""
    }

    <footer class="footer">
      <span>NYU Shanghai Course Planner</span>
      <span>${escapeHtml(majorLabel)}</span>
    </footer>
  </main>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
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

  return {
    courseCount: countCoursesInPlan(plan),
  };
}
