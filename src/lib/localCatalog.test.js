import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_CATALOG_BY_ID, normalizeCourseName } from "./localCatalog.js";

test("removes trailing Roman numerals from runtime course names", () => {
  assert.equal(normalizeCourseName("Elementary Chinese II"), "Elementary Chinese");
  assert.equal(normalizeCourseName("Intermediate Chinese I"), "Intermediate Chinese");
  assert.equal(normalizeCourseName("Civilization II: Rome"), "Civilization II: Rome");
});

test("infers writing requirements from generated fulfillment text", () => {
  const course = LOCAL_CATALOG_BY_ID.get("WRIT-SHU-101");

  assert.equal(course.category, "writing");
  assert.deepEqual(course.requirementIds, ["writing"]);
  assert.deepEqual(course.campuses, ["Shanghai"]);
});

test("infers science requirements from ED fulfillment text", () => {
  const course = LOCAL_CATALOG_BY_ID.get("BIOL-SHU-21");

  assert.equal(course.category, "core");
  assert.ok(course.requirementIds.includes("science"));
  assert.ok(course.requirementIds.includes("science-ed"));
  assert.ok(!course.requirementIds.includes("science-sts"));
});

test("distinguishes STS from Experimental Discovery", () => {
  const course = LOCAL_CATALOG_BY_ID.get("CCST-SHU-133");

  assert.ok(course.requirementIds.includes("science"));
  assert.ok(course.requirementIds.includes("science-sts"));
  assert.ok(!course.requirementIds.includes("science-ed"));
});

test("infers algorithmic thinking requirements from AT fulfillment text", () => {
  const course = LOCAL_CATALOG_BY_ID.get("INTM-SHU-103");

  assert.equal(course.category, "core");
  assert.ok(course.requirementIds.includes("algorithmic-thinking"));
});
