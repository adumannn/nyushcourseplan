import test from "node:test";
import assert from "node:assert/strict";
import { importPlanFromJSON } from "./planTransfer.js";

test("importPlanFromJSON imports semesters, major, and student name", async () => {
  const file = {
    async text() {
      return JSON.stringify({
        kind: "nyu-shanghai-course-plan",
        version: 2,
        major: "business",
        studentName: "Test Student",
        semesters: {
          "Y1-Fall": [
            {
              id: "BUSF-SHU-202",
              code: "BUSF-SHU 202",
              name: "Foundations of Finance",
              credits: 4,
              category: "major-required",
              campuses: ["Shanghai", "New York"],
            },
          ],
        },
      });
    },
  };

  const imported = await importPlanFromJSON(file);

  assert.equal(imported.major, "business");
  // Legacy export without a secondMajor field imports as single-major.
  assert.equal(imported.secondMajor, null);
  assert.equal(imported.studentName, "Test Student");
  assert.equal(imported.plan["Y1-Fall"].length, 1);
  assert.equal(imported.plan["Y1-Fall"][0].id, "BUSF-SHU-202");
  assert.deepEqual(imported.plan["Y1-Fall"][0].campuses, [
    "Shanghai",
    "New York",
  ]);
});

test("importPlanFromJSON carries a valid secondMajor through", async () => {
  const file = {
    async text() {
      return JSON.stringify({
        kind: "nyu-shanghai-course-plan",
        version: 2,
        major: "cs",
        secondMajor: "economics",
        studentName: "",
        semesters: {},
      });
    },
  };

  const imported = await importPlanFromJSON(file);
  assert.equal(imported.major, "cs");
  assert.equal(imported.secondMajor, "economics");
});

test("importPlanFromJSON drops an invalid or duplicate secondMajor", async () => {
  const makeFile = (secondMajor) => ({
    async text() {
      return JSON.stringify({
        kind: "nyu-shanghai-course-plan",
        version: 2,
        major: "cs",
        secondMajor,
        semesters: {},
      });
    },
  });

  assert.equal((await importPlanFromJSON(makeFile("not-a-major"))).secondMajor, null);
  assert.equal((await importPlanFromJSON(makeFile("cs"))).secondMajor, null);
  assert.equal((await importPlanFromJSON(makeFile(42))).secondMajor, null);
});
