-- ============================================================
-- Migration: Create recipes table, RPC, indexes, RLS, storage
-- ============================================================

-- 1. Recipes table
CREATE TABLE recipes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 200),
  ingredients TEXT[] NOT NULL CHECK (array_length(ingredients, 1) > 0),
  instructions TEXT NOT NULL CHECK (char_length(instructions) >= 10),
  prep_time INTEGER,
  photo_path TEXT,
  embedding VECTOR(1536),
  embedding_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'complete', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- 2. B-tree indexes
CREATE INDEX idx_recipes_user_id ON recipes (user_id);
CREATE INDEX idx_recipes_user_created ON recipes (user_id, created_at DESC);

-- 3. HNSW vector index
CREATE INDEX idx_recipes_embedding ON recipes
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. match_recipes RPC for semantic search
CREATE OR REPLACE FUNCTION match_recipes(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  user_id UUID,
  name TEXT,
  ingredients TEXT[],
  instructions TEXT,
  prep_time INTEGER,
  photo_path TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id, r.user_id, r.name, r.ingredients, r.instructions,
    r.prep_time, r.photo_path,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM recipes r
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. RLS on recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recipes"
  ON recipes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert own recipes"
  ON recipes FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authors can update own recipes"
  ON recipes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authors can delete own recipes"
  ON recipes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 7. RLS on herbs (currently unprotected)
ALTER TABLE herbs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view herbs"
  ON herbs FOR SELECT
  USING (true);

-- 8. Storage bucket for recipe photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recipe-photos', 'recipe-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

CREATE POLICY "Anyone can view recipe photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe-photos');

CREATE POLICY "Authenticated users can upload own recipe photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-photos'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own recipe photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'recipe-photos'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own recipe photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-photos'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );
