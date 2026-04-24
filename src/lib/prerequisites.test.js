import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPrerequisiteWarnings,
  hydrateCoursePrerequisites,
  resolvePrerequisiteData,
} from "./prerequisites.js";

test("expands WRIT-SHU 101 or 102 into one prerequisite group", () => {
  const result = resolvePrerequisiteData({
    prerequisiteNote:
      "C or better in WRIT-SHU 101 or 102 Writing as Inquiry. Students cannot register for more than one section of PoH.",
    prerequisiteIds: ["WRIT-SHU-101"],
  });

  assert.deepEqual(result.prerequisiteGroups, [["WRIT-SHU-101", "WRIT-SHU-102"]]);
  assert.deepEqual(result.prerequisites, ["WRIT-SHU-101", "WRIT-SHU-102"]);
});

test("groups CRWR-SHU 260 alternatives into a single OR set", () => {
  const result = resolvePrerequisiteData({
    prerequisiteNote:
      "Writing as Inquiry WRIT-SHU 101/102 OR CRWR-SHU 159 Introduction to Creative Writing OR CRWR-SHU 161 Introduction to Creative Writing: Literary Translation Focus",
    prerequisiteIds: ["WRIT-SHU-101", "CRWR-SHU-159", "CRWR-SHU-161"],
  });

  assert.deepEqual(result.prerequisiteGroups, [
    ["WRIT-SHU-101", "WRIT-SHU-102", "CRWR-SHU-159", "CRWR-SHU-161"],
  ]);
});

test("parses BUSF-SHU 202 into required and alternative groups", () => {
  const result = resolvePrerequisiteData({
    prerequisiteNote:
      "ECON-SHU 3 Microeconomics and (BUSF-SHU 101 Statistics for Business & Econ or MATH-SHU 235 Probability and Statistics).",
    prerequisiteIds: ["ECON-SHU-3", "BUSF-SHU-101", "MATH-SHU-235"],
  });

  assert.deepEqual(result.prerequisiteGroups, [
    ["ECON-SHU-3"],
    ["BUSF-SHU-101", "MATH-SHU-235"],
  ]);
});

test("parses CSCI-SHU 350 into two AND groups", () => {
  const result = resolvePrerequisiteData({
    prerequisiteNote:
      "( CSCI-SHU 11 or CSCI-SHU 101 ) AND (CENG-SHU 202 or CENG-SHU 201).",
    prerequisiteIds: [
      "CSCI-SHU-11",
      "CSCI-SHU-101",
      "CENG-SHU-202",
      "CENG-SHU-201",
    ],
  });

  assert.deepEqual(result.prerequisiteGroups, [
    ["CSCI-SHU-11", "CSCI-SHU-101"],
    ["CENG-SHU-202", "CENG-SHU-201"],
  ]);
});

test("keeps only trackable course IDs when notes include untrackable alternatives", () => {
  const result = resolvePrerequisiteData({
    prerequisiteNote:
      "CHIN-SHU 302 or with the instructor's permission.",
    prerequisiteIds: ["CHIN-SHU-302"],
  });

  assert.deepEqual(result.prerequisiteGroups, [["CHIN-SHU-302"]]);
  assert.ok(
    result.parseIssues.includes("prerequisite-has-untrackable-alternative"),
  );
});

test("planner warnings treat WRIT-SHU 102 as satisfying PoH in an earlier semester", () => {
  const plan = {
    first: [{ id: "WRIT-SHU-102" }],
    second: [
      hydrateCoursePrerequisites({
        id: "CCCF-SHU-101W19",
        prerequisiteNote:
          "C or better in WRIT-SHU 101 or 102 Writing as Inquiry. Students cannot register for more than one section of PoH.",
        prerequisites: ["WRIT-SHU-101"],
      }),
    ],
  };

  const warnings = buildPrerequisiteWarnings(plan, ["first", "second"]);

  assert.deepEqual(warnings, {});
});

test("planner warnings keep the WRIT-SHU OR-group unmet when neither course is earlier", () => {
  const plan = {
    first: [],
    second: [
      hydrateCoursePrerequisites({
        id: "CCCF-SHU-101W19",
        prerequisiteNote:
          "C or better in WRIT-SHU 101 or 102 Writing as Inquiry. Students cannot register for more than one section of PoH.",
        prerequisites: ["WRIT-SHU-101"],
      }),
    ],
  };

  const warnings = buildPrerequisiteWarnings(plan, ["first", "second"]);

  assert.deepEqual(warnings["CCCF-SHU-101W19"], [
    ["WRIT-SHU-101", "WRIT-SHU-102"],
  ]);
});

test("planner warnings consider either BUSF-SHU 101 or MATH-SHU 235 sufficient", () => {
  const plan = {
    first: [{ id: "ECON-SHU-3" }, { id: "MATH-SHU-235" }],
    second: [
      hydrateCoursePrerequisites({
        id: "BUSF-SHU-202",
        prerequisiteNote:
          "ECON-SHU 3 Microeconomics and (BUSF-SHU 101 Statistics for Business & Econ or MATH-SHU 235 Probability and Statistics).",
        prerequisites: ["ECON-SHU-3", "BUSF-SHU-101", "MATH-SHU-235"],
      }),
    ],
  };

  const warnings = buildPrerequisiteWarnings(plan, ["first", "second"]);

  assert.deepEqual(warnings, {});
});
