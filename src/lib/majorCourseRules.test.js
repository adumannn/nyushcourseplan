import assert from "node:assert/strict";
import test from "node:test";
import {
  getEffectiveCategory,
  getEffectiveCategoryForMajors,
  isCourseRelevantToMajors,
} from "./majorCourseRules.js";

test("active major requirements override a catalog course's generic category", () => {
  assert.equal(
    getEffectiveCategory({ id: "PHYS-SHU-93", category: "elective" }, "physics"),
    "major-required",
  );
});

test("major courses for other majors remain free electives", () => {
  assert.equal(
    getEffectiveCategory({ id: "PHYS-SHU-93", category: "major-required" }, "cs"),
    "elective",
  );
});

test("a course required by the second major shows as major-required", () => {
  assert.equal(
    getEffectiveCategoryForMajors({ id: "PHYS-SHU-93", category: "elective" }, [
      "cs",
      "physics",
    ]),
    "major-required",
  );
});

test("a course required by the primary major stays major-required with a second major set", () => {
  assert.equal(
    getEffectiveCategoryForMajors(
      { id: "CSCI-SHU-101", category: "major-required" },
      ["cs", "physics"],
    ),
    "major-required",
  );
});

test("major-required beats major-elective when the two majors disagree", () => {
  // CSCI-SHU-360 is required for Data Science but only an open elective for CS.
  assert.equal(
    getEffectiveCategoryForMajors(
      { id: "CSCI-SHU-360", category: "major-elective" },
      ["cs", "data-science"],
    ),
    "major-required",
  );
});

test("a course that is a major elective for either major shows as major-elective", () => {
  assert.equal(
    getEffectiveCategoryForMajors({ id: "CSCI-SHU-376", category: "elective" }, [
      "physics",
      "cs",
    ]),
    "major-elective",
  );
});

test("a course in neither major's space falls back to the primary major's view", () => {
  assert.equal(
    getEffectiveCategoryForMajors(
      { id: "PHYS-SHU-93", category: "major-required" },
      ["business", "economics"],
    ),
    "elective",
  );
});

test("combined category with one major matches the single-major resolution", () => {
  const course = { id: "PHYS-SHU-93", category: "major-required" };
  assert.equal(
    getEffectiveCategoryForMajors(course, ["cs", null]),
    getEffectiveCategory(course, "cs"),
  );
});

test("relevance is satisfied by either major", () => {
  const course = { id: "PHYS-SHU-93", category: "major-required" };
  assert.equal(isCourseRelevantToMajors(course, ["cs"]), false);
  assert.equal(isCourseRelevantToMajors(course, ["cs", "physics"]), true);
});
