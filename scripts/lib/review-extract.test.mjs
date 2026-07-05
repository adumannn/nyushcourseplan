import assert from "node:assert/strict";
import test from "node:test";
import {
  sha256Hex,
  isStub,
  cleanText,
  asString,
  asStringArray,
  buildPrompt,
  COMBINED_SCHEMA,
  normalizeCourses,
  mergeCourses,
  buildIdResolver,
  buildRows,
  removeExtracted,
} from "./review-extract.mjs";

test("sha256Hex is stable and hex", () => {
  assert.equal(sha256Hex("abc"), sha256Hex("abc"));
  assert.match(sha256Hex("abc"), /^[0-9a-f]{64}$/);
  assert.notEqual(sha256Hex("abc"), sha256Hex("abd"));
});

test("isStub catches placeholders and empties", () => {
  for (const s of ["", "  ", "N/A", "none", "Unstated", "unknown", "not stated", undefined])
    assert.equal(isStub(s), true, `expected stub: ${s}`);
  assert.equal(isStub("Moderate"), false);
});

test("cleanText trims real values, blanks stubs", () => {
  assert.equal(cleanText("  Heavy  "), "Heavy");
  assert.equal(cleanText("N/A"), "");
});

test("asString / asStringArray coerce defensively", () => {
  assert.equal(asString(5), "");
  assert.equal(asString("x"), "x");
  assert.deepEqual(asStringArray(["a", " b ", "", 3]), ["a", "b"]);
  assert.deepEqual(asStringArray("nope"), []);
});

test("removeExtracted drops catalog rows whose id was extracted (any spelling)", () => {
  const catalog = [
    { id: "CSCI-SHU-101", code: "CSCI-SHU 101", name: "Intro to CS" },
    { id: "CSCI-SHU-210", code: "CSCI-SHU 210", name: "Data Structures" },
    { id: "BUSF-SHU-101", code: "BUSF-SHU 101", name: "Stats" },
  ];
  const resolve = buildIdResolver(catalog);
  const extracted = [
    { course_id: "CSCI-SHU 101" },  // space variant still resolves
    { course_id: "NOPE-999" },      // unknown id is ignored
  ];
  const remaining = removeExtracted(catalog, extracted, resolve);
  assert.deepEqual(remaining.map((c) => c.id), ["CSCI-SHU-210", "BUSF-SHU-101"]);
});

test("COMBINED_SCHEMA nests professors under courses", () => {
  const courseProps = COMBINED_SCHEMA.properties.courses.items.properties;
  assert.ok(courseProps.course_id);
  assert.ok(courseProps.evidence);
  assert.ok(courseProps.professors.items.properties.teaching_style_en);
  assert.ok(courseProps.professors.items.properties.evidence);
});

test("buildPrompt embeds the catalog, the doc, key rules, and the per-call cap", () => {
  const slice = [{ id: "CSCI-SHU-101", code: "CSCI-SHU 101", name: "Intro to CS" }];
  const prompt = buildPrompt(slice, "DOC-BODY-MARKER", { maxCourses: 30 });
  assert.match(prompt, /CSCI-SHU-101\tCSCI-SHU 101\tIntro to CS/);
  assert.match(prompt, /DOC-BODY-MARKER/);
  assert.match(prompt, /MUST come EXACTLY from the catalog/);
  assert.match(prompt, /verbatim/i);
  assert.match(prompt, /马什老师/); // bilingual same-person instruction present
  assert.match(prompt, /AT MOST 30 courses/);
  assert.match(prompt, /catalog order/i); // pagination contract: first N in catalog order
});

test("normalizeCourses fills defaults and coerces shapes", () => {
  const out = normalizeCourses({
    courses: [
      { course_id: " CSCI-SHU-101 ", summary_en: "ok" }, // missing arrays/profs
      { nonsense: true },
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].course_id, "CSCI-SHU-101");
  assert.deepEqual(out[0].key_points_en, []);
  assert.deepEqual(out[0].professors, []);
  assert.equal(out[1].course_id, "");
});

test("normalizeCourses keeps nested professor fields", () => {
  const out = normalizeCourses({
    courses: [{
      course_id: "X", professors: [
        { name: "Marsh", pros_en: ["clear"], evidence: ["很好"] },
      ],
    }],
  });
  assert.equal(out[0].professors[0].name, "Marsh");
  assert.deepEqual(out[0].professors[0].pros_en, ["clear"]);
  assert.deepEqual(out[0].professors[0].evidence, ["很好"]);
});

test("mergeCourses dedupes by course_id, unions, longest summary wins", () => {
  const a = normalizeCourses({ courses: [{ course_id: "X", summary_en: "short", key_points_en: ["k1"] }] });
  const b = normalizeCourses({ courses: [{ course_id: "X", summary_en: "a longer summary", key_points_en: ["k1", "k2"] }] });
  const merged = mergeCourses([a, b]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].summary_en, "a longer summary");
  assert.deepEqual(merged[0].key_points_en, ["k1", "k2"]);
});

test("mergeCourses merges professors by lowercased name, unions pros", () => {
  const a = normalizeCourses({ courses: [{ course_id: "X", professors: [{ name: "Marsh", pros_en: ["clear"] }] }] });
  const b = normalizeCourses({ courses: [{ course_id: "X", professors: [
    { name: "marsh", pros_en: ["funny"] },     // same person, different case
    { name: "Chen", cons_en: ["strict"] },      // new person
  ] }] });
  const merged = mergeCourses([a, b]);
  const profs = merged[0].professors;
  assert.equal(profs.length, 2);
  const marsh = profs.find((p) => p.name.toLowerCase() === "marsh");
  assert.deepEqual(marsh.pros_en, ["clear", "funny"]);
});

const CATALOG = [
  { id: "CSCI-SHU-220", code: "CSCI-SHU 220", name: "Algorithms" },
];

test("buildIdResolver maps id/code/space/dash variants, null for unknown", () => {
  const r = buildIdResolver(CATALOG);
  assert.equal(r("CSCI-SHU-220"), "CSCI-SHU-220");
  assert.equal(r("CSCI-SHU 220"), "CSCI-SHU-220");
  assert.equal(r("csci-shu220"), "CSCI-SHU-220");
  assert.equal(r("WRIT-SHU-101"), null);
  assert.equal(r(""), null);
});

test("buildRows shapes rows, drops unknown ids, joins evidence into raw_zh", () => {
  const resolve = buildIdResolver(CATALOG);
  const courses = normalizeCourses({ courses: [
    {
      course_id: "CSCI-SHU 220", summary_en: "Solid course", difficulty_en: "Hard",
      workload_en: "N/A", key_points_en: ["curved", "none"], evidence: ["算法很难"],
      professors: [
        { name: "Prof Wang", summary_en: "Clear", teaching_style_en: "lecture", pros_en: ["fair"], cons_en: [], evidence: ["王老师讲得清楚"] },
        { name: "", summary_en: "ghost" },               // no name -> skipped
      ],
    },
    { course_id: "NOPE-SHU-999", summary_en: "x" },       // unknown -> dropped
    { course_id: "CSCI-SHU 220", summary_en: "", professors: [] }, // dup id, empty -> no extra course row
  ] });

  const { courseRows, profRows, droppedIds } = buildRows(mergeCourses([courses]), resolve, "2026-06-22T00:00:00Z");

  assert.equal(courseRows.length, 1);
  assert.equal(courseRows[0].course_id, "CSCI-SHU-220");
  assert.equal(courseRows[0].workload_en, "");                 // "N/A" cleaned
  assert.deepEqual(courseRows[0].key_points_en, ["curved"]);   // "none" filtered
  assert.equal(courseRows[0].raw_zh, "算法很难");
  assert.match(courseRows[0].content_hash, /^[0-9a-f]{64}$/);

  assert.equal(profRows.length, 1);
  assert.equal(profRows[0].professor_name, "Prof Wang");
  assert.equal(profRows[0].raw_zh, "王老师讲得清楚");
  assert.deepEqual(droppedIds, ["NOPE-SHU-999"]);
});

test("buildRows skips a course with no content but still emits its professors", () => {
  const resolve = buildIdResolver(CATALOG);
  const courses = normalizeCourses({ courses: [
    { course_id: "CSCI-SHU 220", summary_en: "", difficulty_en: "", workload_en: "", key_points_en: [],
      professors: [{ name: "Wang", summary_en: "Great", pros_en: [], cons_en: [], evidence: [] }] },
  ] });
  const { courseRows, profRows } = buildRows(courses, resolve, "T");
  assert.equal(courseRows.length, 0);
  assert.equal(profRows.length, 1);
});
