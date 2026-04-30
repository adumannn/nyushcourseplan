import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCourseCampuses,
  getCampusLabelForSchoolSlug,
  getCourseCampuses,
  getDefaultCampusForSemester,
  normalizeCampuses,
} from "./campus.js";

test("groups NYU New York schools under New York", () => {
  assert.equal(getCampusLabelForSchoolSlug("arts-science"), "New York");
  assert.equal(getCampusLabelForSchoolSlug("stern"), "New York");
  assert.equal(getCampusLabelForSchoolSlug("tandon-engineering"), "New York");
});

test("normalizes and deduplicates course campus labels", () => {
  assert.deepEqual(
    normalizeCampuses(["shanghai", "Shanghai", "New York"]),
    ["Shanghai", "New York"],
  );
  assert.deepEqual(
    getCourseCampuses({ campuses: ["Shanghai", "New York", "Shanghai"] }),
    ["Shanghai", "New York"],
  );
  assert.equal(
    formatCourseCampuses({ campuses: ["Shanghai", "Abu Dhabi"] }),
    "Shanghai, Abu Dhabi",
  );
});

test("uses study-away location as the custom-course default campus", () => {
  assert.equal(
    getDefaultCampusForSemester("Y3-Fall", {
      selectedSemesters: ["Y3-Fall"],
      locations: { "Y3-Fall": "New York" },
    }),
    "New York",
  );
  assert.equal(getDefaultCampusForSemester("Y1-Fall", {}), "Shanghai");
});
