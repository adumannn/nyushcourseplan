// Provider seam. Today the active provider is Gumroad; swapping to Paddle/Stripe
// later means adding a builder here + a matching edge function, with the data
// model, RPCs, and UI unchanged.
import { buildGumroadCheckoutUrl } from "./gumroad.js";

// `productUrl` is injectable for tests; in the app it comes from
// import.meta.env.VITE_GUMROAD_PRODUCT_URL (read at the call site).
export function getCheckoutUrl({ userId, productUrl }) {
  return buildGumroadCheckoutUrl(productUrl, { userId });
}
