-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Herbs table
CREATE TABLE herbs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  how_to_use TEXT,
  category TEXT[],
  embedding extensions.vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_herbs(
  query_embedding extensions.vector(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  description TEXT,
  how_to_use TEXT,
  category TEXT[],
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
    1 - (h.embedding <=> query_embedding) AS similarity
  FROM herbs h
  WHERE 1 - (h.embedding <=> query_embedding) > match_threshold
  ORDER BY h.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Index for cosine similarity search
CREATE INDEX ON herbs USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 10);
