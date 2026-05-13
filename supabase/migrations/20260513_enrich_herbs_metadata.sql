-- Adds source-derived metadata columns to herbs (tags, energetics, botanical_name,
-- plant_part, origin, form) and updates match_herbs to return them so the
-- semantic search and nutritionist tool both surface the new fields.
--
-- Note: pgvector is installed under public on this project (not extensions),
-- so the function uses the unqualified vector type.

ALTER TABLE herbs
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS energetics TEXT[],
  ADD COLUMN IF NOT EXISTS botanical_name TEXT,
  ADD COLUMN IF NOT EXISTS plant_part TEXT,
  ADD COLUMN IF NOT EXISTS origin TEXT,
  ADD COLUMN IF NOT EXISTS form TEXT;

CREATE INDEX IF NOT EXISTS herbs_tags_gin ON herbs USING GIN (tags);

DROP FUNCTION IF EXISTS match_herbs(vector, double precision, integer);

CREATE FUNCTION match_herbs(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  description TEXT,
  how_to_use TEXT,
  category TEXT[],
  tags TEXT[],
  energetics TEXT[],
  botanical_name TEXT,
  plant_part TEXT,
  origin TEXT,
  form TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.description,
    h.how_to_use,
    h.category,
    h.tags,
    h.energetics,
    h.botanical_name,
    h.plant_part,
    h.origin,
    h.form,
    1 - (h.embedding <=> query_embedding) AS similarity
  FROM herbs h
  WHERE 1 - (h.embedding <=> query_embedding) > match_threshold
  ORDER BY h.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
