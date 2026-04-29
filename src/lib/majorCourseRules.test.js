import assert from "node:assert/strict";
import test from "node:test";
import { getEffectiveCategory } from "./majorCourseRules.js";

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
