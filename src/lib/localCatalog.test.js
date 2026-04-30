import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_CATALOG_BY_ID } from "./localCatalog.js";

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
});

test("infers algorithmic thinking requirements from AT fulfillment text", () => {
  const course = LOCAL_CATALOG_BY_ID.get("INTM-SHU-103");

  assert.equal(course.category, "core");
  assert.ok(course.requirementIds.includes("algorithmic-thinking"));
});
