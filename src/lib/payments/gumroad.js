// Pure, dependency-free Gumroad helpers. Shared by the browser (checkout URL)
// and the Deno `gumroad-ping` edge function (ping parsing + sale validation),
// so it MUST stay free of browser- or Deno-only globals.

const PROVIDER = "gumroad";

/**
 * Build the hosted Gumroad checkout URL, carrying the Clerk user id so it
 * comes back to us in the sale Ping as url_params[user_id].
 */
export function buildGumroadCheckoutUrl(baseUrl, { userId }) {
  if (!baseUrl) throw new Error("Gumroad product URL is not configured");
  const sep = baseUrl.includes("?") ? "&" : "?";
  const params = new URLSearchParams({ wanted: "true" });
  if (userId) params.set("user_id", String(userId));
  return `${baseUrl}${sep}${params.toString()}`;
}

/**
 * Normalize a Gumroad Ping (form-encoded fields, already parsed into a plain
 * object) into our canonical event shape.
 */
export function normalizeGumroadPing(form) {
  const saleId = form?.sale_id;
  if (!saleId) throw new Error("Gumroad ping missing sale_id");
  const priceRaw = form.price ?? "0";
  const amountTotal = Number.parseInt(priceRaw, 10);
  return {
    provider: PROVIDER,
    providerSaleId: String(saleId),
    sellerId: form.seller_id ?? null,
    productId: form.product_id ?? null,
    userId: form["url_params[user_id]"] ?? null,
    amountTotal: Number.isNaN(amountTotal) ? 0 : amountTotal,
    currency: form.currency ?? "usd",
  };
}

/**
 * Validate a Gumroad API sale lookup (GET /v2/sales/:id) against our expected
 * seller and product. This is the integrity control: Gumroad Pings are
 * unsigned, so we re-fetch and confirm server-side.
 */
export function isGumroadSaleValid(apiResponse, { expectedSellerId, expectedProductId }) {
  if (!apiResponse || apiResponse.success !== true || !apiResponse.sale) return false;
  const { seller_id, product_id } = apiResponse.sale;
  return seller_id === expectedSellerId && product_id === expectedProductId;
}
