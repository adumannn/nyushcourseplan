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
