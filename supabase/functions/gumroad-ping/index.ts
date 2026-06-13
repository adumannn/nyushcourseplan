// Edge function: gumroad-ping
//
// Receives Gumroad's "Ping" (a form-encoded POST on every sale), re-verifies
// the sale against the Gumroad API (Pings are unsigned), and records supporter
// status idempotently via the record_supporter_payment RPC (service role).
//
// Required secrets:
//   GUMROAD_SELLER_ID    -- our Gumroad seller id (Ping + sale must match)
//   GUMROAD_PRODUCT_ID   -- the support product id (sale must match)
//   GUMROAD_ACCESS_TOKEN -- Gumroad API token for sale re-verification
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the runtime.
import { createClient } from "@supabase/supabase-js";
// Shared pure logic, single source of truth with the browser + Node tests.
import {
  normalizeGumroadPing,
  isGumroadSaleValid,
} from "../../../src/lib/payments/gumroad.js";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function parseForm(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

async function fetchGumroadSale(saleId: string, accessToken: string) {
  const res = await fetch(
    `https://api.gumroad.com/v2/sales/${encodeURIComponent(saleId)}?access_token=${encodeURIComponent(accessToken)}`,
  );
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const sellerId = requireEnv("GUMROAD_SELLER_ID");
    const productId = requireEnv("GUMROAD_PRODUCT_ID");
    const accessToken = requireEnv("GUMROAD_ACCESS_TOKEN");

    const form = await parseForm(req);
    const event = normalizeGumroadPing(form); // throws on missing sale_id -> 400 below

    // Cheap pre-check before spending a Gumroad API call.
    if (event.sellerId !== sellerId || event.productId !== productId) {
      return new Response(JSON.stringify({ ok: false, error: "unrecognized sale" }), {
        status: 202, // ack so Gumroad stops retrying; it just isn't ours
        headers: { "Content-Type": "application/json" },
      });
    }

    // Re-verify against the Gumroad API (Pings are unsigned).
    const sale = await fetchGumroadSale(event.providerSaleId, accessToken);
    if (!isGumroadSaleValid(sale, { expectedSellerId: sellerId, expectedProductId: productId })) {
      return new Response(JSON.stringify({ ok: false, error: "sale failed verification" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { error } = await supabase.rpc("record_supporter_payment", {
      p_provider: event.provider,
      p_sale_id: event.providerSaleId,
      p_user_id: event.userId,
      p_amount: event.amountTotal,
      p_currency: event.currency,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 400 for malformed pings (e.g. missing sale_id); Gumroad will not retry.
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
