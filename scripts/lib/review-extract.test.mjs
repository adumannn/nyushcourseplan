import assert from "node:assert/strict";
import test from "node:test";
import {
  sha256Hex,
  isStub,
  cleanText,
  asString,
  asStringArray,
  buildCatalogSlices,
  buildPrompt,
  COMBINED_SCHEMA,
  normalizeCourses,
  mergeCourses,
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

test("buildCatalogSlices distributes round-robin and drops empties", () => {
  const cat = Array.from({ length: 7 }, (_, i) => ({ id: `C${i}`, code: `c ${i}`, name: `n${i}` }));
  const slices = buildCatalogSlices(cat, 3);
  assert.equal(slices.length, 3);
  assert.deepEqual(slices.map((s) => s.length), [3, 2, 2]); // 0,3,6 | 1,4 | 2,5
  assert.equal(slices.flat().length, 7);
  // k larger than catalog → no empty slices returned
  assert.equal(buildCatalogSlices(cat.slice(0, 2), 5).length, 2);
});

test("COMBINED_SCHEMA nests professors under courses", () => {
  const courseProps = COMBINED_SCHEMA.properties.courses.items.properties;
  assert.ok(courseProps.course_id);
  assert.ok(courseProps.evidence);
  assert.ok(courseProps.professors.items.properties.teaching_style_en);
  assert.ok(courseProps.professors.items.properties.evidence);
});

test("buildPrompt embeds the slice catalog, the doc, and key rules", () => {
  const slice = [{ id: "CSCI-SHU-101", code: "CSCI-SHU 101", name: "Intro to CS" }];
  const prompt = buildPrompt(slice, "DOC-BODY-MARKER");
  assert.match(prompt, /CSCI-SHU-101\tCSCI-SHU 101\tIntro to CS/);
  assert.match(prompt, /DOC-BODY-MARKER/);
  assert.match(prompt, /MUST come EXACTLY from the catalog/);
  assert.match(prompt, /verbatim/i);
  assert.match(prompt, /马什老师/); // bilingual same-person instruction present
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
