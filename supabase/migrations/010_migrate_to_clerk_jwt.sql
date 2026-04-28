-- Migration: Update RLS policies to validate Clerk JWTs instead of Supabase Auth
-- Description: Replaces auth.uid() checks with auth.jwt()->>'sub' (Clerk user ID) for RLS policies

-- Update plans table RLS policy for Clerk JWT validation
DROP POLICY IF EXISTS "Users manage own plans" ON public.plans;
CREATE POLICY "Users manage own plans"
  ON public.plans FOR ALL
  USING (auth.jwt()->>'sub' = user_id::text)
  WITH CHECK (auth.jwt()->>'sub' = user_id::text);

-- Update plan_courses table RLS policy for Clerk JWT validation
DROP POLICY IF EXISTS "Users manage own plan courses" ON public.plan_courses;
CREATE POLICY "Users manage own plan courses"
  ON public.plan_courses FOR ALL
  USING (
    plan_id IN (
      SELECT id FROM public.plans 
      WHERE user_id::text = auth.jwt()->>'sub'
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM public.plans 
      WHERE user_id::text = auth.jwt()->>'sub'
    )
  );

-- Update catalog_courses table RLS policy (if it exists and has one)
-- Catalog courses are typically world-readable, but we'll make sure RLS doesn't block Clerk users
DROP POLICY IF EXISTS "Catalog courses are readable by all" ON public.catalog_courses;
CREATE POLICY "Catalog courses are readable by all"
  ON public.catalog_courses FOR SELECT
  TO authenticated, anon
  USING (true);

-- Update reviews table RLS policies (if reviews table exists)
DROP POLICY IF EXISTS "Users manage own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Reviews are readable by all authenticated users" ON public.reviews;

-- Allow all authenticated users (including Clerk users) to read reviews
CREATE POLICY "Reviews are readable by all authenticated users"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to create reviews when authenticated
CREATE POLICY "Users can create reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt()->>'sub' = user_id::text);

-- Allow users to update their own reviews
CREATE POLICY "Users can update own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.jwt()->>'sub' = user_id::text)
  WITH CHECK (auth.jwt()->>'sub' = user_id::text);

-- Allow users to delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (auth.jwt()->>'sub' = user_id::text);
