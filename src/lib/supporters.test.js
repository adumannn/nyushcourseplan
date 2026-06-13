import assert from "node:assert/strict";
import test from "node:test";
import { mapSupporterRow } from "./supporters.js";

test("mapSupporterRow returns a non-supporter shape for null", () => {
  assert.deepEqual(mapSupporterRow(null), {
    isSupporter: false,
    displayName: null,
    isPublic: false,
    lifetimeAmount: 0,
    firstSupportedAt: null,
  });
});

test("mapSupporterRow maps a supporter row", () => {
  const row = {
    user_id: "u1",
    display_name: "Aigerim",
    is_public: true,
    lifetime_amount: 800,
    first_supported_at: "2026-06-01T00:00:00Z",
  };
  assert.deepEqual(mapSupporterRow(row), {
    isSupporter: true,
    displayName: "Aigerim",
    isPublic: true,
    lifetimeAmount: 800,
    firstSupportedAt: "2026-06-01T00:00:00Z",
  });
});
