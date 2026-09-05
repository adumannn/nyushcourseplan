import assert from "node:assert/strict";
import test from "node:test";
import { localStoragePlan } from "./planStorage.js";

test("local plan cache remembers the active cloud plan", async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  await localStoragePlan.save({
    planId: "plan-2",
    planName: "Study Away",
    plan: { "Y1-Fall": [] },
    major: "cs",
    secondMajor: null,
    studentName: "Test Student",
    studyAway: null,
  });

  const cached = await localStoragePlan.load();
  assert.equal(cached.planId, "plan-2");
  assert.equal(cached.planName, "Study Away");
});
