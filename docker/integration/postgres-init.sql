-- Local integration Postgres (pgvector image).
CREATE EXTENSION IF NOT EXISTS vector;

-- Table + RPC for supabase-vector / PostgREST path (dim 3 for vendor smoke; RAG needs larger — recreate as needed).
CREATE TABLE IF NOT EXISTS ai_tools_vectors (
  id text PRIMARY KEY,
  embedding vector(3),
  metadata jsonb
);

CREATE OR REPLACE FUNCTION match_vectors(
  query_embedding vector,
  match_count int,
  filter jsonb DEFAULT NULL,
  collection text DEFAULT NULL
)
RETURNS TABLE (id text, score float, metadata jsonb, embedding vector)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id,
    1 - (d.embedding <=> query_embedding) AS score,
    d.metadata,
    d.embedding
  FROM ai_tools_vectors d
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT ALL ON TABLE ai_tools_vectors TO aitools;
GRANT EXECUTE ON FUNCTION match_vectors(vector, int, jsonb, text) TO aitools;
