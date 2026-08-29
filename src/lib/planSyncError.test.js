import assert from "node:assert/strict";
import test from "node:test";
import { formatPlanSyncError } from "./planSyncError.js";

test("formatPlanSyncError exposes Supabase diagnostics", () => {
  assert.equal(
    formatPlanSyncError({
      message: "new row violates row-level security policy",
      code: "42501",
      details: "Failing row contains user_123",
      hint: "Check the JWT subject",
    }),
    "new row violates row-level security policy · Code: 42501 · Details: Failing row contains user_123 · Hint: Check the JWT subject",
  );
});
