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
