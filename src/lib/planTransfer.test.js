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
  assert.equal(imported.studentName, "Test Student");
  assert.equal(imported.plan["Y1-Fall"].length, 1);
  assert.equal(imported.plan["Y1-Fall"][0].id, "BUSF-SHU-202");
  assert.deepEqual(imported.plan["Y1-Fall"][0].campuses, [
    "Shanghai",
    "New York",
  ]);
});
