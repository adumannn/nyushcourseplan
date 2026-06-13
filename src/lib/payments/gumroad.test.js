import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGumroadCheckoutUrl,
  normalizeGumroadPing,
  isGumroadSaleValid,
} from "./gumroad.js";

test("buildGumroadCheckoutUrl adds wanted=true and url-encoded user_id", () => {
  const url = buildGumroadCheckoutUrl("https://acme.gumroad.com/l/support", {
    userId: "user_abc/123",
  });
  assert.match(url, /[?&]wanted=true(&|$)/);
  assert.match(url, /[?&]user_id=user_abc%2F123(&|$)/);
});

test("buildGumroadCheckoutUrl preserves an existing query string", () => {
  const url = buildGumroadCheckoutUrl("https://acme.gumroad.com/l/support?x=1", {
    userId: "u1",
  });
  assert.ok(url.startsWith("https://acme.gumroad.com/l/support?x=1&"));
  assert.match(url, /user_id=u1/);
});

test("buildGumroadCheckoutUrl throws on empty base url", () => {
  assert.throws(() => buildGumroadCheckoutUrl("", { userId: "u1" }));
});

test("normalizeGumroadPing maps Gumroad form fields to canonical shape", () => {
  const form = {
    sale_id: "S1",
    seller_id: "SELLER1",
    product_id: "PROD1",
    price: "500",
    currency: "usd",
    "url_params[user_id]": "user_abc",
  };
  assert.deepEqual(normalizeGumroadPing(form), {
    provider: "gumroad",
    providerSaleId: "S1",
    sellerId: "SELLER1",
    productId: "PROD1",
    userId: "user_abc",
    amountTotal: 500,
    currency: "usd",
  });
});

test("normalizeGumroadPing yields userId null when no url_params present", () => {
  const out = normalizeGumroadPing({
    sale_id: "S2",
    seller_id: "SELLER1",
    product_id: "PROD1",
    price: "0",
    currency: "usd",
  });
  assert.equal(out.userId, null);
  assert.equal(out.amountTotal, 0);
});

test("normalizeGumroadPing throws when sale_id missing", () => {
  assert.throws(() => normalizeGumroadPing({ price: "100", currency: "usd" }));
});

test("isGumroadSaleValid requires success + matching seller and product", () => {
  const sale = { success: true, sale: { seller_id: "SELLER1", product_id: "PROD1" } };
  assert.equal(
    isGumroadSaleValid(sale, { expectedSellerId: "SELLER1", expectedProductId: "PROD1" }),
    true,
  );
  assert.equal(
    isGumroadSaleValid(sale, { expectedSellerId: "OTHER", expectedProductId: "PROD1" }),
    false,
  );
  assert.equal(
    isGumroadSaleValid({ success: false }, { expectedSellerId: "SELLER1", expectedProductId: "PROD1" }),
    false,
  );
});
