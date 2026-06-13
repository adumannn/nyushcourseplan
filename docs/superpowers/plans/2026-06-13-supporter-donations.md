# Supporter Donations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional donation rail to the (always-free) NYU Shanghai Course Planner: signed-in users tip via Gumroad, a server-verified webhook records supporter status, and they get a cosmetic badge + an opt-in public Supporters wall. A manual Alipay/WeChat QR rail covers China-based donors.

**Architecture:** Gumroad hosted checkout (pay-what-you-want) behind a thin provider seam. A single Deno edge function `gumroad-ping` verifies each sale against the Gumroad API and writes supporter state via a `SECURITY DEFINER` RPC using the service-role key (clients can never self-promote). Postgres holds a `supporter_payments` ledger (idempotency) + a `supporters` profile row, with RLS own-row reads and a `public_supporters` view for the wall. The UI is a `#supporters` hash-route view — no router dependency — reachable from the Clerk user menu + a small footer.

**Tech Stack:** React 19, Vite 8, Tailwind 4, Clerk (`@clerk/react`), Supabase (Postgres + RLS + Edge Functions/Deno), Node built-in test runner, Gumroad (payments).

---

## Reference: established patterns this plan follows

- **Tests:** `node --test "src/**/*.test.js"`. Files are co-located `*.test.js`, using `import test from "node:test"` and `import assert from "node:assert/strict"`. Run a single file with `node --test src/lib/payments/gumroad.test.js`.
- **Edge functions:** Deno, `Deno.serve(async (req) => {...})`, secrets via `Deno.env.get(...)` (see `requireEnv` helper in `ingest-reviews`), `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`. Import map in a sibling `deno.json`.
- **Migrations:** append-only, numbered. Next is `019`. RPCs use `language plpgsql`, `set search_path = public`, read the caller via `(select auth.jwt()->>'sub')`, and end with `revoke all ... from public; grant execute ... to <role>;` (see `018_add_second_major.sql`).
- **Auth bridge:** `useAuth()` exposes `{ user, getToken }`. `getSupabaseClientWithAuth(getToken)` returns a Supabase client that attaches the Clerk JWT (for RLS). The plain `supabase` client (anon) is used for public reads.
- **Views:** the app currently renders conditional full-screen views/modals from `App.jsx` state (e.g. `suggestionOpen`). We add a `#supporters` hash that maps to such a view.

## File structure

**Create**
- `supabase/migrations/019_supporters.sql` — tables, RLS, view, two RPCs.
- `src/lib/payments/gumroad.js` — pure logic: `buildGumroadCheckoutUrl`, `normalizeGumroadPing`, `isGumroadSaleValid`.
- `src/lib/payments/gumroad.test.js` — Node tests for the above.
- `src/lib/payments/provider.js` — provider seam: `getCheckoutUrl({ userId })` for the active provider.
- `src/lib/payments/provider.test.js` — Node test for the seam.
- `src/lib/supporters.js` — `mapSupporterRow` (pure) + `getMySupporterStatus`, `getPublicSupporters`, `setWallProfile` (network).
- `src/lib/supporters.test.js` — Node test for `mapSupporterRow`.
- `src/hooks/useSupporter.js` — supporter status hook (no test harness; manual verification).
- `src/components/supporters/SupporterBadge.jsx`
- `src/components/supporters/SupportersView.jsx`
- `src/components/supporters/SupportThanksToast.jsx`
- `supabase/functions/gumroad-ping/index.ts`
- `supabase/functions/gumroad-ping/deno.json`
- `supabase/functions/gumroad-ping/README.md`

**Modify**
- `src/App.jsx` — supporters view state + hash routing + `?supported=1` handling + render view/toast/footer; pass `onOpenSupporters` to `Header`.
- `src/components/layout/Header.jsx` — add a `Support ✦` action to the Clerk `<UserButton>` menu; new `onOpenSupporters` prop.
- `AGENTS.md` — document the feature.
- `README.md` — add the `VITE_GUMROAD_PRODUCT_URL` env var + Gumroad/QR setup notes.

**Test harness note:** the repo has Node tests for pure JS only (no jsdom / React Testing Library, no SQL test DB). So pure functions get real TDD; the migration, edge function, hook, and components get **concrete manual/integration verification steps** (exact commands + expected output) instead of fabricated unit tests. Do not invent a React test harness for this plan.

---

## Task 1: Migration 019 — schema, RLS, view, RPCs

**Files:**
- Create: `supabase/migrations/019_supporters.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/019_supporters.sql`:

```sql
-- Supporter donations: a payments ledger (idempotency), per-user supporter
-- profile rows, a public wall view, and the RPCs that mutate them.
--
-- Apply this migration BEFORE deploying the client that reads public_supporters
-- and calls update_supporter_profile (same rollout discipline as 015/018).

-- 1. Ledger: one row per processed sale. Service-role only. user_id is
--    nullable so direct Gumroad purchases (no Clerk sub in url_params) still
--    record without attaching to an account.
create table if not exists public.supporter_payments (
  provider          text        not null default 'gumroad',
  provider_sale_id  text        not null,
  user_id           text,
  amount_total      int         not null,
  currency          text        not null,
  created_at        timestamptz not null default now(),
  primary key (provider, provider_sale_id)
);

-- 2. Profile: one row per supporting user. Amount/identity fields are
--    webhook-owned; display_name/is_public are user-editable via RPC.
create table if not exists public.supporters (
  user_id            text        primary key,
  display_name       text,
  is_public          boolean     not null default false,
  lifetime_amount    int         not null default 0,
  first_supported_at timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 3. RLS. supporter_payments has RLS on with NO policies -> all client roles
--    denied; only the service-role key (which bypasses RLS) can touch it.
alter table public.supporter_payments enable row level security;

alter table public.supporters enable row level security;

drop policy if exists "read own supporter row" on public.supporters;
create policy "read own supporter row" on public.supporters
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);
-- No insert/update/delete policies: clients cannot write supporter rows.

-- 4. Public wall view. Runs with owner rights (security_invoker defaults to
--    false), so it bypasses the supporters RLS above, but exposes only two
--    columns and only opt-in rows -> safe public projection.
drop view if exists public.public_supporters;
create view public.public_supporters as
  select display_name, first_supported_at
  from public.supporters
  where is_public = true
    and display_name is not null;

grant select on public.public_supporters to anon, authenticated;

-- 5. record_supporter_payment: idempotent webhook writer. Inserts the ledger
--    row (no-op on replay) and, only on a genuinely new sale, upserts the
--    supporter profile. Never clobbers user-set display_name/is_public.
create or replace function public.record_supporter_payment(
  p_provider text,
  p_sale_id  text,
  p_user_id  text,
  p_amount   int,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.supporter_payments
    (provider, provider_sale_id, user_id, amount_total, currency)
  values
    (p_provider, p_sale_id, p_user_id, p_amount, p_currency)
  on conflict (provider, provider_sale_id) do nothing;

  -- Duplicate ping (conflict) -> nothing inserted -> stop.
  if not found then
    return;
  end if;

  -- Anonymous/direct purchases have no Clerk sub: ledger only.
  if p_user_id is null then
    return;
  end if;

  insert into public.supporters (user_id, lifetime_amount, first_supported_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id) do update
    set lifetime_amount = public.supporters.lifetime_amount + excluded.lifetime_amount,
        updated_at = now();
end;
$$;

revoke all on function public.record_supporter_payment(text, text, text, int, text) from public;
grant execute on function public.record_supporter_payment(text, text, text, int, text) to service_role;

-- 6. update_supporter_profile: the only way a client edits wall fields, scoped
--    to the caller's Clerk sub. Updates an EXISTING row only.
create or replace function public.update_supporter_profile(
  p_display_name text,
  p_is_public    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.supporters
  set display_name = nullif(trim(coalesce(p_display_name, '')), ''),
      is_public    = coalesce(p_is_public, false),
      updated_at   = now()
  where user_id = (select auth.jwt()->>'sub');

  if not found then
    raise exception 'Not a supporter yet' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.update_supporter_profile(text, boolean) from public;
grant execute on function public.update_supporter_profile(text, boolean) to authenticated;
```

- [ ] **Step 2: Apply the migration to a local/staging Supabase and verify**

Run (against a local Supabase, or a disposable staging project — never prod first):

```bash
supabase db push
```

Expected: applies `019_supporters.sql` with no errors.

- [ ] **Step 3: Verify objects exist and RLS is on**

Run in the SQL editor / `psql`:

```sql
select tablename, rowsecurity from pg_tables
  where schemaname='public' and tablename in ('supporters','supporter_payments');
select proname from pg_proc
  where proname in ('record_supporter_payment','update_supporter_profile');
select table_name from information_schema.views
  where table_schema='public' and table_name='public_supporters';
```

Expected: both tables present with `rowsecurity = t`; both functions present; the view present.

- [ ] **Step 4: Smoke-test the idempotent writer**

```sql
select public.record_supporter_payment('gumroad','test_sale_1','user_abc',500,'usd');
select public.record_supporter_payment('gumroad','test_sale_1','user_abc',500,'usd'); -- replay
select user_id, lifetime_amount from public.supporters where user_id='user_abc';
```

Expected: `lifetime_amount = 500` (NOT 1000 — the replay was a no-op). Clean up:

```sql
delete from public.supporters where user_id='user_abc';
delete from public.supporter_payments where provider_sale_id='test_sale_1';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/019_supporters.sql
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "feat(db): add supporters schema, RLS, wall view, and RPCs"
```

---

## Task 2: Gumroad pure logic — checkout URL, ping normalization, sale validation

**Files:**
- Create: `src/lib/payments/gumroad.js`
- Test: `src/lib/payments/gumroad.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/payments/gumroad.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/payments/gumroad.test.js`
Expected: FAIL — `Cannot find module './gumroad.js'`.

- [ ] **Step 3: Implement the pure logic**

Create `src/lib/payments/gumroad.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/payments/gumroad.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments/gumroad.js src/lib/payments/gumroad.test.js
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "feat(payments): add pure Gumroad checkout/ping/validation helpers"
```

---

## Task 3: Provider seam

**Files:**
- Create: `src/lib/payments/provider.js`
- Test: `src/lib/payments/provider.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/payments/provider.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/payments/provider.test.js`
Expected: FAIL — `Cannot find module './provider.js'`.

- [ ] **Step 3: Implement the seam**

Create `src/lib/payments/provider.js`:

```js
// Provider seam. Today the active provider is Gumroad; swapping to Paddle/Stripe
// later means adding a builder here + a matching edge function, with the data
// model, RPCs, and UI unchanged.
import { buildGumroadCheckoutUrl } from "./gumroad.js";

// `productUrl` is injectable for tests; in the app it comes from
// import.meta.env.VITE_GUMROAD_PRODUCT_URL (read at the call site).
export function getCheckoutUrl({ userId, productUrl }) {
  return buildGumroadCheckoutUrl(productUrl, { userId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/payments/provider.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments/provider.js src/lib/payments/provider.test.js
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "feat(payments): add provider seam over Gumroad checkout"
```

---

## Task 4: `gumroad-ping` edge function

**Files:**
- Create: `supabase/functions/gumroad-ping/deno.json`
- Create: `supabase/functions/gumroad-ping/index.ts`
- Create: `supabase/functions/gumroad-ping/README.md`

- [ ] **Step 1: Write the import map**

Create `supabase/functions/gumroad-ping/deno.json`:

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.39.7"
  }
}
```

- [ ] **Step 2: Write the function**

Create `supabase/functions/gumroad-ping/index.ts`:

```ts
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
```

- [ ] **Step 3: Write the README**

Create `supabase/functions/gumroad-ping/README.md`:

```md
# gumroad-ping

Receives Gumroad sale Pings, re-verifies each sale via the Gumroad API, and
records supporter status idempotently through `record_supporter_payment`.

## Secrets (set with `supabase secrets set`)
- `GUMROAD_SELLER_ID` — our seller id (find via the Gumroad API `/v2/user`).
- `GUMROAD_PRODUCT_ID` — the support product's id.
- `GUMROAD_ACCESS_TOKEN` — Gumroad API access token.

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected by the runtime.

## Wiring in Gumroad
Product → Settings → **Ping**: set the endpoint to
`https://<project-ref>.supabase.co/functions/v1/gumroad-ping`.

## Manual grant (Alipay/WeChat QR donors)
There is no webhook for QR tips. Grant a badge by hand:
```sql
select public.record_supporter_payment('manual', '<unique-ref>', '<clerk_user_id>', <cents>, 'cny');
```

## Local smoke test
`supabase functions serve gumroad-ping` then POST a form body (see plan Task 4 Step 5).
A body missing `sale_id` returns 400; a body whose seller/product don't match returns 202.
```

- [ ] **Step 4: Deploy and configure (integration)**

```bash
supabase functions deploy gumroad-ping
supabase secrets set GUMROAD_SELLER_ID=... GUMROAD_PRODUCT_ID=... GUMROAD_ACCESS_TOKEN=...
```

Then in Gumroad, set the product's **Ping** endpoint to the deployed function URL. (Account/product creation is covered in Task 9 ops.)

- [ ] **Step 5: Smoke-test rejection paths locally**

Run the function locally:

```bash
supabase functions serve gumroad-ping --no-verify-jwt --env-file supabase/functions/gumroad-ping/.env.local
```

(`.env.local` holds the three `GUMROAD_*` plus `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for local serving; do NOT commit it — it is already covered by `.gitignore` for env files; confirm.)

In another shell:

```bash
# Missing sale_id -> 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:54321/functions/v1/gumroad-ping \
  -d "price=500&currency=usd"
# Wrong seller/product -> 202 (acked, not ours)
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:54321/functions/v1/gumroad-ping \
  -d "sale_id=X&seller_id=NOPE&product_id=NOPE&price=500&currency=usd"
```

Expected: first prints `400`, second prints `202`. (A genuinely valid sale is exercised end-to-end in Task 9.)

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/gumroad-ping
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "feat(payments): add gumroad-ping edge function"
```

---

## Task 5: Supporters client lib

**Files:**
- Create: `src/lib/supporters.js`
- Test: `src/lib/supporters.test.js`

- [ ] **Step 1: Write the failing test (pure mapper)**

Create `src/lib/supporters.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/supporters.test.js`
Expected: FAIL — `Cannot find module './supporters.js'`.

- [ ] **Step 3: Implement the lib**

Create `src/lib/supporters.js`:

```js
import { supabase, getSupabaseClientWithAuth } from "./supabase";

/** Pure: shape a supporters row (or null) into the app's status object. */
export function mapSupporterRow(row) {
  return {
    isSupporter: !!row,
    displayName: row?.display_name ?? null,
    isPublic: row?.is_public ?? false,
    lifetimeAmount: row?.lifetime_amount ?? 0,
    firstSupportedAt: row?.first_supported_at ?? null,
  };
}

/** Read the signed-in user's own supporter status (RLS-scoped). */
export async function getMySupporterStatus(getToken) {
  const db = await getSupabaseClientWithAuth(getToken);
  if (!db) return mapSupporterRow(null);
  const { data, error } = await db
    .from("supporters")
    .select("display_name, is_public, lifetime_amount, first_supported_at")
    .maybeSingle();
  if (error) {
    console.error("[supporters] getMySupporterStatus", error);
    return mapSupporterRow(null);
  }
  return mapSupporterRow(data);
}

/** Read the public Supporters wall (opt-in rows only; anon-readable view). */
export async function getPublicSupporters() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("public_supporters")
    .select("display_name, first_supported_at")
    .order("first_supported_at", { ascending: true });
  if (error) {
    console.error("[supporters] getPublicSupporters", error);
    return [];
  }
  return data ?? [];
}

/** Set the caller's wall display name + opt-in, via the SECURITY DEFINER RPC. */
export async function setWallProfile(getToken, { displayName, isPublic }) {
  const db = await getSupabaseClientWithAuth(getToken);
  if (!db) throw new Error("Not signed in");
  const { error } = await db.rpc("update_supporter_profile", {
    p_display_name: displayName ?? "",
    p_is_public: !!isPublic,
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/supporters.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full test suite (no regressions)**

Run: `npm test`
Expected: all tests pass (existing + the new payments/supporters tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supporters.js src/lib/supporters.test.js
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "feat(payments): add supporters client lib"
```

---

## Task 6: `useSupporter` hook

**Files:**
- Create: `src/hooks/useSupporter.js`

(No React test harness in the repo — verified manually in Task 8.)

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useSupporter.js`:

```js
import { useState, useEffect, useCallback } from "react";
import { getMySupporterStatus, setWallProfile } from "../lib/supporters";

/**
 * Tracks the signed-in user's supporter status. `getToken` comes from useAuth().
 * Pass a falsy `getToken` when signed out to stay in the non-supporter state.
 */
export default function useSupporter(getToken) {
  const [status, setStatus] = useState({
    isSupporter: false,
    displayName: null,
    isPublic: false,
    lifetimeAmount: 0,
    firstSupportedAt: null,
  });
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (typeof getToken !== "function") return;
    setLoading(true);
    try {
      setStatus(await getMySupporterStatus(getToken));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const saveWallProfile = useCallback(
    async ({ displayName, isPublic }) => {
      await setWallProfile(getToken, { displayName, isPublic });
      await refetch();
    },
    [getToken, refetch],
  );

  return { ...status, loading, refetch, saveWallProfile };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSupporter.js
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "feat(payments): add useSupporter hook"
```

---

## Task 7: Supporter UI components

**Files:**
- Create: `src/components/supporters/SupporterBadge.jsx`
- Create: `src/components/supporters/SupportThanksToast.jsx`
- Create: `src/components/supporters/SupportersView.jsx`

(Manual verification in Task 8. Tailwind classes below mirror existing usage — `bg-card`, `border-border`, `text-muted-foreground`, etc.)

- [ ] **Step 1: SupporterBadge**

Create `src/components/supporters/SupporterBadge.jsx`:

```jsx
import { Sparkles } from "lucide-react";

/** Small cosmetic badge shown next to a supporter's name. */
export default function SupporterBadge({ className = "" }) {
  return (
    <span
      title="Supporter"
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500 ${className}`}
    >
      <Sparkles size={11} />
      Supporter
    </span>
  );
}
```

- [ ] **Step 2: SupportThanksToast**

Create `src/components/supporters/SupportThanksToast.jsx`:

```jsx
import { useState } from "react";
import { X } from "lucide-react";

/**
 * Post-purchase thank-you. Lets a confirmed supporter set a wall display name
 * and opt in. `isSupporter` becomes true once the webhook lands (parent polls).
 */
export default function SupportThanksToast({ isSupporter, onSaveWallProfile, onClose }) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSaveWallProfile({ displayName: name, isPublic });
      setSaved(true);
    } catch {
      /* surfaced via parent refetch; keep the toast forgiving */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
      <button
        onClick={onClose}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        aria-label="Close"
      >
        <X size={16} />
      </button>
      <p className="text-sm font-medium">Thank you for supporting! 💛</p>
      {!isSupporter && (
        <p className="mt-1 text-xs text-muted-foreground">
          Confirming your payment… your badge will appear shortly.
        </p>
      )}
      {isSupporter && !saved && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-muted-foreground">
            Show on the Supporters wall as (optional):
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            List me publicly
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-md bg-primary px-2 py-1 text-sm text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {saved && <p className="mt-2 text-xs text-muted-foreground">Saved — see you on the wall!</p>}
    </div>
  );
}
```

- [ ] **Step 3: SupportersView**

Create `src/components/supporters/SupportersView.jsx`:

```jsx
import { useEffect, useState } from "react";
import { X, Heart } from "lucide-react";
import { getCheckoutUrl } from "../../lib/payments/provider";
import { getPublicSupporters } from "../../lib/supporters";

const PRODUCT_URL = import.meta.env.VITE_GUMROAD_PRODUCT_URL || "";
const TIERS = [3, 5, 10]; // suggested amounts (USD); Gumroad is pay-what-you-want

export default function SupportersView({ user, onClose }) {
  const [wall, setWall] = useState([]);

  useEffect(() => {
    getPublicSupporters().then(setWall);
  }, []);

  const startCheckout = () => {
    if (!user) return; // CTA is disabled when signed out
    const url = getCheckoutUrl({ userId: user.id, productUrl: PRODUCT_URL });
    window.location.href = url;
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Heart size={20} className="text-amber-500" /> Support the Planner
          </h1>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          This planner is free and always will be. If it saved you some time, you can chip in —
          purely optional, and supporters get a small badge.
        </p>

        {/* Engineered rail: Gumroad */}
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          {!user && (
            <p className="mb-3 text-sm text-muted-foreground">Sign in to support and get your badge.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {TIERS.map((amount) => (
              <button
                key={amount}
                onClick={startCheckout}
                disabled={!user || !PRODUCT_URL}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                ☕ ${amount}
              </button>
            ))}
            <button
              onClick={startCheckout}
              disabled={!user || !PRODUCT_URL}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Choose amount
            </button>
          </div>
        </div>

        {/* China rail: Alipay / WeChat QR (manual badge grant) */}
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Paying from China?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Scan to tip via WeChat or Alipay. Message me your account name and I'll add your
            Supporter badge.
          </p>
          <div className="mt-3 flex gap-4">
            <img src="/wechat-tip.png" alt="WeChat tip QR" className="h-40 w-40 rounded-md border border-border" />
            <img src="/alipay-tip.png" alt="Alipay tip QR" className="h-40 w-40 rounded-md border border-border" />
          </div>
        </div>

        {/* Wall */}
        <div className="mt-6">
          <h2 className="text-sm font-medium">Supporters</h2>
          {wall.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Be the first to appear here.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {wall.map((s, i) => (
                <li key={i} className="rounded-full border border-border bg-card px-3 py-1 text-xs">
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/supporters
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "feat(payments): add supporter badge, thank-you toast, and supporters view"
```

---

## Task 8: Wire into the app (routing, entry points, footer)

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/layout/Header.jsx`

- [ ] **Step 1: Add the `Support ✦` action to the Clerk user menu**

In `src/components/layout/Header.jsx`:

1. Add `Heart` to the `lucide-react` import and `UserButton` is already imported from `@clerk/react`.
2. Add `onOpenSupporters` to the destructured props (near `onOpenSuggestion`).
3. Find the existing `<UserButton appearance={clerkAppearance} />` and replace it with the children form:

```jsx
<UserButton appearance={clerkAppearance}>
  <UserButton.MenuItems>
    <UserButton.Action
      label="Support ✦"
      labelIcon={<Heart size={16} />}
      onClick={onOpenSupporters}
    />
  </UserButton.MenuItems>
</UserButton>
```

- [ ] **Step 2: Add supporters state, hash routing, success handling, and render in `App.jsx`**

In `src/App.jsx`:

1. Add imports near the other component imports:

```jsx
import SupportersView from "./components/supporters/SupportersView";
import SupportThanksToast from "./components/supporters/SupportThanksToast";
import useSupporter from "./hooks/useSupporter";
```

2. Inside `AppContent`, after the existing `useState` modal flags, add:

```jsx
const [supportersOpen, setSupportersOpen] = useState(
  () => typeof window !== "undefined" && window.location.hash === "#supporters",
);
const [thanksOpen, setThanksOpen] = useState(false);
const { isSupporter, saveWallProfile, refetch: refetchSupporter } = useSupporter(getToken);

const openSupporters = () => {
  window.location.hash = "supporters";
};
const closeSupporters = () => {
  if (window.location.hash === "#supporters") {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  setSupportersOpen(false);
};

// Hash is the source of truth for the supporters view.
useEffect(() => {
  const sync = () => setSupportersOpen(window.location.hash === "#supporters");
  window.addEventListener("hashchange", sync);
  return () => window.removeEventListener("hashchange", sync);
}, []);

// Post-purchase return: ?supported=1 -> show thanks, poll until the badge lands.
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("supported") !== "1") return;
  setThanksOpen(true);
  setSupportersOpen(true);
  params.delete("supported");
  const qs = params.toString();
  history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}#supporters`);
  let tries = 0;
  const id = setInterval(() => {
    tries += 1;
    refetchSupporter();
    if (tries >= 6) clearInterval(id); // ~30s of polling
  }, 5000);
  return () => clearInterval(id);
}, [refetchSupporter]);
```

3. Pass the handler to `<Header ... />` (add alongside `onOpenSuggestion`):

```jsx
onOpenSupporters={openSupporters}
```

4. Just before `<Analytics />` in the returned JSX, add the footer, view, and toast:

```jsx
<footer className="mt-8 border-t border-border py-4 text-center text-xs text-muted-foreground">
  <button onClick={openSupporters} className="inline-flex items-center gap-1 hover:text-foreground">
    <Heart size={12} /> Support the planner
  </button>
</footer>
{supportersOpen && <SupportersView user={user} onClose={closeSupporters} />}
{thanksOpen && (
  <SupportThanksToast
    isSupporter={isSupporter}
    onSaveWallProfile={saveWallProfile}
    onClose={() => setThanksOpen(false)}
  />
)}
```

5. Add `Heart` to the existing `lucide-react` import at the top of `App.jsx` (it currently imports `{ ListChecks, X }`).

- [ ] **Step 3: Show the badge next to the signed-in user (optional placement)**

Where the app renders the user's name/avatar area (the `Header` near `<UserButton>`), render `{isSupporter && <SupporterBadge />}`. To keep `isSupporter` in one place, pass it from `App.jsx` into `Header` as a prop `isSupporter={isSupporter}`, add it to Header's destructured props, import `SupporterBadge` in `Header.jsx`, and render it beside the `<UserButton>`:

```jsx
{isSupporter && <SupporterBadge className="mr-1" />}
```

- [ ] **Step 4: Lint + run dev server, verify manually**

```bash
npm run lint
npm run dev
```

Verify in the browser (signed in):
- The Clerk avatar menu shows **Support ✦**; clicking it sets `#supporters` and opens the view.
- The footer link opens the same view.
- Tier buttons are enabled (once `VITE_GUMROAD_PRODUCT_URL` is set in `.env.local`); signed out, they're disabled with the sign-in hint.
- Visiting `/?supported=1` shows the thank-you toast and rewrites the URL to `#supporters`.
- The wall renders (empty state if no public supporters).

Expected: no lint errors; all interactions behave as above. (Real payment flow is exercised in Task 9.)

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/layout/Header.jsx
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "feat(payments): wire supporters view, badge, and entry points into the app"
```

---

## Task 9: Docs, ops, and end-to-end verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: Gumroad + Supabase ops (one-time setup)**

1. Create a Gumroad account; in payout settings confirm the **Kazakhstan** payout method (PayPal or direct bank transfer).
2. Create a **pay-what-you-want** product named "Support the Planner"; set a suggested price; enable "Redirect after purchase" to `https://nyushplanner.app/?supported=1`.
3. Note the product URL (e.g. `https://<user>.gumroad.com/l/<id>`), product id, and seller id; generate an API access token.
4. `supabase secrets set GUMROAD_SELLER_ID=… GUMROAD_PRODUCT_ID=… GUMROAD_ACCESS_TOKEN=…`
5. In the product's **Ping** settings, set the endpoint to the deployed `gumroad-ping` URL.
6. Add `VITE_GUMROAD_PRODUCT_URL=<product url>` to the deploy env (Vercel) and local `.env.local`.
7. Add `public/wechat-tip.png` and `public/alipay-tip.png` (personal receiving QR images).

- [ ] **Step 2: End-to-end live test (then refund)**

Gumroad has no sandbox. With everything deployed:
1. Sign in on the live site, open `#supporters`, click a tier, complete a real small purchase.
2. Confirm redirect to `?supported=1` → toast appears.
3. Within ~30s the **Supporter** badge appears (webhook landed). Verify a `supporters` row exists.
4. Set a wall display name + opt in; confirm it shows on the wall.
5. Refund the test sale in Gumroad.

Expected: badge + wall update without manual intervention; the row's `lifetime_amount` matches the tip.

- [ ] **Step 3: Update `AGENTS.md`**

Add a "Supporter donations" subsection under Architecture documenting: the `supporters` + `supporter_payments` tables, `record_supporter_payment` / `update_supporter_profile` RPCs and the `public_supporters` view (migration 019); the `gumroad-ping` edge function and its secrets; the `src/lib/payments/*` seam, `src/lib/supporters.js`, `useSupporter.js`; the `#supporters` hash view, badge, and footer/user-menu entry points; the `VITE_GUMROAD_PRODUCT_URL` env var; and the manual QR-donor grant path. Also add `gumroad-ping` to the `supabase/functions/` line of the Repository Map.

- [ ] **Step 4: Update `README.md`**

Add `VITE_GUMROAD_PRODUCT_URL` to the environment-variables section with a one-line description, and a short "Supporting the project" note.

- [ ] **Step 5: Final full verification**

```bash
npm test && npm run lint && npm run build
```

Expected: tests pass, no lint errors, build succeeds.

- [ ] **Step 6: Commit and push**

```bash
git add AGENTS.md README.md
git -c user.name='Duman' -c user.email='da3762@nyu.edu' commit -m "docs: document supporter donations feature and env"
git push
```

---

## Self-review notes (for the implementer)

- **Migration before client:** deploy migration 019 and the `gumroad-ping` function before the frontend that reads `public_supporters` / calls `update_supporter_profile` (same ordering discipline as 015/018).
- **Single source of truth:** `src/lib/payments/gumroad.js` is imported by both the browser and the Deno function. If the Supabase bundler ever fails to resolve the `../../../src/...` import at deploy time, the minimal fix is to re-export those two functions from a file inside `supabase/functions/gumroad-ping/` — but the relative import is the intended approach; verify it bundles during Task 4 Step 4.
- **Secrets never client-side:** only `VITE_GUMROAD_PRODUCT_URL` (a public product link) is exposed to the browser. `GUMROAD_*` and the service-role key live solely in the edge-function environment.
- **Idempotency** is enforced by `supporter_payments`' primary key and the `if not found` guard in `record_supporter_payment` (verified in Task 1 Step 4).
```
