-- ============================================================
-- Migration: Remove community recipes (never launched)
-- Drops everything 20260331_create_recipes.sql added except the
-- herbs RLS policy, which search still relies on.
-- ============================================================

-- 1. Storage policies for recipe photos
DROP POLICY IF EXISTS "Anyone can view recipe photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own recipe photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own recipe photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own recipe photos" ON storage.objects;

-- 2. recipe-photos bucket. storage.protect_delete blocks direct deletes
-- unless allow_delete_query is set; the objects FK (no cascade) still
-- aborts this if the bucket holds any files, so nothing is orphaned.
SET storage.allow_delete_query = 'true';
DELETE FROM storage.buckets WHERE id = 'recipe-photos';
RESET storage.allow_delete_query;

-- 3. Semantic search RPC. Dropped by name: the vector type lives in
-- `extensions` locally but `public` on the remote project.
DROP FUNCTION IF EXISTS match_recipes;

-- 4. Table (its indexes, trigger and RLS policies go with it)
DROP TABLE IF EXISTS recipes;

-- 5. updated_at trigger function (only used by recipes)
DROP FUNCTION IF EXISTS public.update_updated_at_column();
