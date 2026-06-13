# Supporter Donations — Design

**Date:** 2026-06-13
**Status:** Approved (brainstorming) — pending implementation plan
**Surface:** nyushplanner.app

## 1. Context & Goal

The NYU Shanghai Course Planner is a free, niche tool with dozens of organic
users (heaviest at registration time). The owner is a Kazakhstani citizen
studying in mainland China.

**Primary goal is signal, not revenue.** This feature exists to demonstrate a
real, end-to-end payments integration (resume / portfolio value) and to learn
monetization mechanics — *not* to maximize dollars. At current scale, donation
revenue is expected to be near zero; the value is the engineering artifact and a
measurable conversion experiment later.

**Chosen mechanism:** optional donations / tips only. The core tool stays
**100% free** — no feature is ever gated. This avoids any backlash that could
kill the word-of-mouth growth the tool depends on.

**Audience:** all NYU campuses (NY + Shanghai + Abu Dhabi, ~29k undergrads). The
catalog pipeline already scrapes all 15 NYU bulletins, so the tool is not
Shanghai-locked.

## 2. Key Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Monetization model | Donations/tips, tool stays free | Fits signal goal + zero backlash |
| Supporter perks | Cosmetic only: badge + opt-in wall | True donation, never a paywall |
| Payment provider | **Gumroad**, behind a thin provider seam | Confirmed Kazakhstan payouts, instant onboarding, pay-what-you-want is donation-native; seam keeps Paddle/Stripe swappable later |
| China donors | Manual Alipay/WeChat receiving QR | Mainland-China crowd often can't use card/PayPal checkout; owner can hold a Chinese bank account |
| Entry points | User/profile menu + footer link | Header is already crowded — no new top-level button |
| Supporters surface | Dedicated `#supporters` hash-route view | App has no router; matches existing modal/view-state pattern |

### Why not the alternatives

- **Stripe** — merchant/payout country list excludes both Kazakhstan and
  mainland China. Cannot onboard.
- **Paddle** — supports Kazakhstan sellers, but as a Merchant of Record it
  vets sellers and its Acceptable Use Policy generally prohibits standalone
  donations/tips; a free student tool risks rejection and multi-day onboarding.
  Kept as a future swap target behind the seam.
- **Lemon Squeezy** — moving onto Stripe Managed Payments, so Kazakhstan is
  likely excluded.

## 3. Non-Goals (YAGNI)

- No recurring subscriptions / memberships (one-time tips only).
- No anonymous tipping on the engineered rail (badge needs an identity →
  sign-in required to support via Gumroad).
- No admin dashboard (Gumroad's own dashboard covers payment ops).
- No automated badge for QR donors (manual grant; see §7).
- No new routing library; no refactor of unrelated app structure.
- No conversion A/B instrumentation in v1 (fast-follow — see §11).

## 4. User Flows

### 4.1 Engineered rail (Gumroad)

1. Signed-in user opens the **Supporters** view (`#supporters`) via the
   user/profile menu or footer link.
2. Clicks a tier (suggested ☕ $3 / $5 / $10, or custom — Gumroad
   pay-what-you-want). Client redirects to the Gumroad checkout overlay/URL,
   passing the Clerk `user_id` as a URL parameter.
3. User pays on Gumroad's hosted checkout (no card data touches our app).
4. Gumroad redirects back to `https://nyushplanner.app/?supported=1#supporters`.
   The app reads `?supported=1` → shows a thank-you toast and prompts the user
   to optionally set a **wall display name** and opt into the public wall.
5. **Asynchronously**, Gumroad sends a **Ping** (sale webhook) to the
   `gumroad-ping` edge function → the function verifies the sale → writes to
   `supporter_payments` (idempotent) and upserts the `supporters` profile row
   using the **service-role key**. This is the *only* writer of supporter
   status, so a client cannot self-promote.
6. On next load (and via a short poll on the success screen), the client reads
   its own `supporters` row → renders the **Supporter ✦** badge.

### 4.2 China rail (Alipay / WeChat QR)

1. On the `#supporters` view, a clearly separated section shows the owner's
   personal Alipay and WeChat receiving QR images with a short note: *"Paying
   from China? Scan to tip. Message me your account name and I'll add your
   Supporter badge."*
2. No webhook. The owner manually grants supporter status (see §7).

## 5. Architecture

### 5.1 Provider seam

A thin abstraction so the provider is swappable without touching the data model
or UI:

- **Client:** `src/lib/payments/provider.js` exposes the active provider and a
  `getCheckoutUrl({ userId })` builder. `src/lib/payments/gumroad.js` implements
  it (base product URL from public env + `wanted=true` + encoded `user_id`).
- **Server contract:** every provider's webhook normalizes its payload to a
  canonical shape `{ provider, providerSaleId, userId, amountTotal, currency }`,
  then runs the same idempotent upsert. Swapping providers = a new edge function
  + a new client builder; the table, RPC, view, badge, and wall are unchanged.

### 5.2 Edge function: `gumroad-ping` (Deno, mirrors `ingest-reviews`)

- Receives Gumroad's form-encoded **Ping** POST on each sale.
- **Verifies authenticity:** checks `seller_id` matches `GUMROAD_SELLER_ID`
  *and* re-fetches the sale from the Gumroad API with `GUMROAD_ACCESS_TOKEN`
  to confirm it exists and matches amount/product. (Gumroad Pings have no
  signing secret, so re-verification is the integrity control.)
- **Extracts** the Clerk `user_id` from the sale's `url_params`.
- **Idempotent write:** `INSERT ... ON CONFLICT (provider, provider_sale_id) DO
  NOTHING` into `supporter_payments`. Only on a genuinely new row does it upsert
  `supporters` (create the profile row if absent, set `first_supported_at` if
  null, accumulate `lifetime_amount`). Retried Pings are no-ops.
- Writes with the service-role client (bypasses RLS). Returns `200` quickly.
- **Secrets** (Supabase function env / Vault, never client): `GUMROAD_SELLER_ID`,
  `GUMROAD_ACCESS_TOKEN`, `GUMROAD_PRODUCT_ID`. `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` are runtime-injected (as in `ingest-reviews`).

Pure logic (payload→canonical normalization, idempotency/aggregation decisions,
URL building) lives in plain JS under `src/lib/payments/` so it is covered by the
Node test runner; the Deno handler is a thin shell over it. (Whether the function
imports the shared `.js` directly or keeps a verified-in-sync copy is an
implementation detail for the plan; single source of truth preferred.)

## 6. Data Model — migration `019_supporters.sql`

Append-only, follows the existing numbered convention. Clerk IDs are `text` and
match `plans.user_id`; RLS keys off `auth.jwt()->>'sub'`.

```
public.supporter_payments          -- ledger, idempotency, service-role only
  provider          text    NOT NULL DEFAULT 'gumroad'
  provider_sale_id  text    NOT NULL
  user_id           text    NOT NULL          -- Clerk sub
  amount_total      int     NOT NULL           -- minor units (cents)
  currency          text    NOT NULL
  created_at        timestamptz DEFAULT now()
  PRIMARY KEY (provider, provider_sale_id)

public.supporters                  -- one profile row per user
  user_id            text  PRIMARY KEY         -- Clerk sub
  display_name       text                       -- null until user opts in
  is_public          boolean DEFAULT false      -- wall opt-in, default private
  lifetime_amount    int     DEFAULT 0          -- maintained by webhook
  first_supported_at timestamptz DEFAULT now()
  updated_at         timestamptz DEFAULT now()
```

### RLS & access

- `supporter_payments`: RLS enabled, **no** anon/authenticated policies → all
  client access denied; only the service-role webhook reads/writes.
- `supporters`:
  - `SELECT` own row: `auth.jwt()->>'sub' = user_id` (powers the badge).
  - **No** client `INSERT`/`UPDATE`. Amount/identity fields are webhook-owned.
  - Users set their wall fields through a `SECURITY DEFINER` RPC
    `update_supporter_profile(p_display_name text, p_is_public boolean)` that
    updates *only* `display_name` / `is_public` for `auth.jwt()->>'sub'`
    (mirrors the existing `save_plan_with_courses` RPC pattern). This prevents
    column tampering that a blanket UPDATE policy would allow.
- `public_supporters` **view** (the wall): exposes only
  `display_name, first_supported_at` `WHERE is_public = true AND display_name IS
  NOT NULL`; `GRANT SELECT` to `anon, authenticated`. No amounts, IDs, or private
  rows leak.

## 7. Manual supporter grant (QR donors)

For Alipay/WeChat donors there is no webhook. v1 path: the owner inserts a row
directly via a service-role SQL snippet (documented in the function/README),
setting `lifetime_amount` and `first_supported_at`, optionally `display_name` /
`is_public`. A lightweight admin "grant supporter" action (the app already has an
admin concept via `feedbackAdmin.js` / `SuggestionInbox`) is a possible
fast-follow, out of scope for v1.

## 8. Frontend

- `src/lib/payments/provider.js`, `src/lib/payments/gumroad.js` — provider seam +
  checkout-URL builder.
- `src/lib/supporters.js` — `getMySupporterStatus(getToken)`,
  `getPublicSupporters()`, `setWallProfile(getToken, { displayName, isPublic })`
  (calls the RPC).
- `src/hooks/useSupporter.js` — `{ isSupporter, displayName, isPublic,
  lifetimeAmount, refetch, setWallProfile }`.
- Components:
  - `SupportersView` — the `#supporters` page: intro, tier CTA (engineered rail),
    the public wall (`getPublicSupporters`), and the China QR section.
  - `SupporterBadge` — small `✦` next to the signed-in user's name where the
    user is rendered.
  - Success toast — reads `?supported=1`, thanks the user, offers wall opt-in
    (display name + public toggle), polls supporter status briefly until the
    webhook lands.
  - Entry points — a "Support ✦" item in the existing user/profile menu and a
    footer link, both routing to `#supporters`.
- **Routing:** a minimal hash-route view toggle (`#supporters`) in `App.jsx`'s
  view state — no router dependency. The Gumroad success redirect uses the query
  param `?supported=1` (read on load) plus the `#supporters` hash.
- **Public env** (client): the Gumroad base product URL (e.g.
  `VITE_GUMROAD_PRODUCT_URL`). No secrets client-side.

## 9. Security

- Payment-provider secrets live only in the edge-function environment; never
  shipped to the client.
- Supporter status is webhook-written with the service-role key → a client
  cannot forge a badge.
- Ping authenticity enforced by `seller_id` check **and** server-side
  re-verification of the sale via the Gumroad API.
- Idempotency via `PRIMARY KEY (provider, provider_sale_id)` → replayed/retried
  Pings can't double-count or duplicate.
- The public wall is a column- and row-restricted view; private supporters and
  all amounts/IDs stay invisible.
- Wall fields are user-editable only through a `SECURITY DEFINER` RPC scoped to
  the caller's Clerk sub — no direct table writes.

## 10. Testing

Unit tests (existing Node test runner over `src`):

- Checkout-URL builder: correct base, `wanted=true`, URL-encoded `user_id`.
- Payload normalization: Gumroad Ping fields → canonical
  `{ provider, providerSaleId, userId, amountTotal, currency }`, including
  extracting `url_params.user_id` and mapping price/currency.
- Idempotency decision: existing `provider_sale_id` → no-op.
- Aggregation: first payment sets `first_supported_at`; repeat bumps
  `lifetime_amount` without clobbering user-set `display_name` / `is_public`.

Integration / manual:

- **Caveat:** Gumroad has no Stripe-style test mode. End-to-end is verified with
  a real small purchase that is then refunded, confirming the Ping fires, the
  function verifies, and the badge + wall update.

## 11. Rollout & Ops

1. Create Gumroad account; confirm Kazakhstan payout method (PayPal or bank).
2. Create a pay-what-you-want "Support the Planner" product; note product URL,
   `seller_id`, `product_id`; generate an API access token.
3. Add Supabase function secrets (`GUMROAD_*`).
4. Apply migration `019`.
5. Deploy the `gumroad-ping` edge function; set its URL as the product's Ping
   endpoint (or create a sale resource subscription).
6. Set the public client env (product URL); build & deploy the frontend
   (Supporters view, menu/footer links, badge, success toast, QR images in
   `/public`).
7. End-to-end test with a real purchase, then refund.
8. Upload personal Alipay/WeChat receiving QR images to `/public`.

## 12. Future / Open

- **Conversion experiment (Approach C):** instrument impressions → clicks →
  completed tips, and A/B a passive footer CTA vs. a moment-of-value ask (e.g.
  after a successful plan export). This is the most resume-worthy follow-up and
  only matters once usage grows.
- **Growth:** expanding active usage across NYU campuses is what turns a <1% tip
  rate into real numbers; monetization is downstream of reach.
- Refund/dispute handling (downgrade supporter on refund Ping).
- Recurring support (Gumroad memberships) if ever wanted.
- Admin "grant supporter" UI for QR donors.
- Provider swap to Paddle/Stripe if the owner relocates to a supported country.

## 13. Docs

`AGENTS.md` is updated **in the implementation commit** (per project workflow):
the `supporters` / `supporter_payments` tables + RPC + view, the `gumroad-ping`
function, the `src/lib/payments/*` seam, `src/lib/supporters.js`,
`useSupporter.js`, the Supporters view + badge, the `#supporters` route, and the
new env vars.
