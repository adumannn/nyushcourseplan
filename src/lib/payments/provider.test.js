import assert from "node:assert/strict";
import test from "node:test";
import { getCheckoutUrl } from "./provider.js";

test("getCheckoutUrl builds a Gumroad URL from an explicit base", () => {
  const url = getCheckoutUrl({ userId: "u1", productUrl: "https://acme.gumroad.com/l/x" });
  assert.match(url, /^https:\/\/acme\.gumroad\.com\/l\/x\?/);
  assert.match(url, /wanted=true/);
  assert.match(url, /user_id=u1/);
});

test("getCheckoutUrl throws when no product URL is configured", () => {
  assert.throws(() => getCheckoutUrl({ userId: "u1", productUrl: "" }));
});
