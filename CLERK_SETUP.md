# Clerk + Supabase Setup Guide

## ✅ Implementation Complete

The codebase has been successfully migrated from **Supabase Auth** to **Clerk OAuth** with free custom domain support. All code changes are committed. Now you need to configure Clerk with your custom domain.

---

## Step 1: Create Clerk Account & Application

1. Go to **[https://dashboard.clerk.com](https://dashboard.clerk.com)**
2. Sign up for a free account (or sign in if you have one)
3. Click **"Create Application"**
4. Choose **Google** as your OAuth provider (optionally add others later)
5. Name it something like `NYU Course Planner` or `Course Plan Shanghai`
6. Click **Create Application**

---

## Step 2: Get API Keys

1. In your Clerk Dashboard, go to **Developers → API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_...` or `pk_live_...`)
3. Copy your **Secret Key** (starts with `sk_test_...` or `sk_live_...`)

---

## Step 3: Update Environment Variables

Edit your `.env` file with the keys from Step 2:

```bash
# Clerk configuration
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Keep existing Supabase keys
VITE_SUPABASE_URL=https://pbyqozmqqkhgbnnjhsly.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

---

## Step 4: Configure Custom Domain (Optional but Recommended)

This solves your original problem — no more paying for a Supabase custom domain upgrade.

### Option A: Clerk's Free Custom Domain (Easiest)

1. In **Clerk Dashboard → Domains**
2. Click **Add Domain**
3. Enter your custom domain (e.g., `auth.courseplanner.nyu.edu`)
4. Clerk will show you DNS records to add to your domain registrar
5. Add the CNAME records as instructed
6. Wait for DNS propagation (~5-15 minutes)

### Option B: Subdomain (Fastest Setup)

If you don't have a custom domain yet:
- Keep Clerk's default domain (e.g., `learned-moose-12.clerk.accounts.com`)
- It works fine but looks generic
- You can add a custom domain anytime later

---

## Step 5: Configure OAuth Providers (Google)

1. In **Clerk Dashboard → Social Connections**
2. Click **Google** to configure
3. Clerk auto-configures Google OAuth if you don't have custom settings
4. If using a custom domain from Step 4, verify the redirect URIs include your domain:
   - `https://auth.courseplanner.nyu.edu/oauth/callback/google`
   - `https://learned-moose-12.clerk.accounts.com/oauth/callback/google` (fallback)

---

## Step 6: Configure Email Restrictions (NYU Only)

1. In **Clerk Dashboard → Email, Phone, Username**
2. Under **Allowed Domains**, add:
   - `nyu.edu`
   - `nyu.edu.cn`
3. This restricts sign-ups to NYU email addresses

---

## Step 7: Deploy RLS Migration to Supabase

The codebase now includes a migration file that updates Supabase's row-level security to validate Clerk JWTs.

### For Local Development

```bash
# Connect to your local Supabase (if using Supabase CLI)
supabase db push supabase/migrations/010_migrate_to_clerk_jwt.sql
```

### For Production Supabase

1. Go to **[supabase.com](https://supabase.com) → Your Project → SQL Editor**
2. Open the file `supabase/migrations/010_migrate_to_clerk_jwt.sql` from your codebase
3. Copy the entire migration SQL
4. Paste into Supabase SQL Editor
5. Click **Run**

This updates all RLS policies to check Clerk JWTs instead of Supabase sessions.

---

## Step 8: Test Locally

```bash
# Install dependencies (if not already done)
npm install

# Start dev server
npm run dev
```

1. Open `http://localhost:5173`
2. You should see the Clerk sign-in UI (or a custom domain redirect if configured)
3. Click **Continue with Google**
4. Sign in with your NYU email
5. After sign-in, your course plan should load
6. Try adding courses, saving changes, and refreshing — localStorage persists your plan

---

## Step 9: Verify Supabase Integration

Once you're signed in:

1. Open **Browser DevTools → Network**
2. Add a course to a semester
3. Look for a Supabase API call (e.g., to `/rest/v1/plans`)
4. Check the request headers — you should see:
   ```
   Authorization: Bearer <YOUR_CLERK_JWT>
   ```
5. Verify the response is `200 OK`, not `403 Forbidden`

If you see `403`, the RLS policy update didn't apply. Re-run the migration in Supabase.

---

## Step 10: Test Cross-Device Persistence

1. Sign in and create a course plan
2. Open the app in an **incognito/private window**
3. Sign in with the same NYU email
4. Your course plan should appear (synced from Supabase, not `localStorage`)

---

## Troubleshooting

### Issue: "Missing Publishable Key"

**Fix:** Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env` and you've restarted your dev server.

```bash
# Restart after .env changes
npm run dev
```

### Issue: OAuth Redirect Loop

**Likely cause:** Your Clerk domain configuration doesn't match your app URL.

**Fix:**
1. Check Clerk Dashboard → Domains
2. Ensure the domain you're using in the browser matches one of your configured domains
3. For localhost dev, no domain config needed (automatic)

### Issue: "User not found in Supabase"

**Likely cause:** RLS migration wasn't applied to Supabase.

**Fix:** Re-run the migration in Supabase SQL Editor (Step 7).

### Issue: Courses aren't persisting across refresh

**Likely cause:** Supabase query failed due to RLS rejection (403).

**Fix:**
1. Check browser console for errors
2. Verify `Authorization` header is being sent (Step 9)
3. Re-run Supabase migration

---

## Next Steps (Optional)

- **Multiple Plans:** Implement a plan switcher (Phase 2.5 in CLAUDE.md)
- **Email/Password Auth:** Add to Clerk if you want non-OAuth sign-in
- **Custom Domain with Custom Branding:** Upgrade Clerk to Pro for advanced theming ($20/mo)
- **Export/Import:** Let users export course plans as JSON

---

## Support

- **Clerk Docs:** [https://clerk.com/docs](https://clerk.com/docs)
- **Clerk Support:** [https://support.clerk.com](https://support.clerk.com)
- **Supabase Clerk Integration:** [https://supabase.com/docs/guides/auth/auth-clerk](https://supabase.com/docs/guides/auth/auth-clerk)

---

**Summary:**
- ✅ Codebase migrated to Clerk
- ✅ Custom domain support unlocked (free tier)
- ⏳ You need to: Create Clerk app → Get API keys → Update `.env` → Deploy RLS migration
- 📝 Estimated time: 10-15 minutes

Good luck! 🚀
