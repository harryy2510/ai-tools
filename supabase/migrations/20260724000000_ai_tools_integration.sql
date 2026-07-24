-- ai-tools local integration: vector table + match RPC + storage bucket

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.ai_tools_vectors (
  id text PRIMARY KEY,
  embedding extensions.vector(3),
  metadata jsonb
);

CREATE OR REPLACE FUNCTION public.match_vectors(
  query_embedding extensions.vector,
  match_count int,
  filter jsonb DEFAULT NULL,
  collection text DEFAULT NULL
)
RETURNS TABLE (id text, score float, metadata jsonb, embedding extensions.vector)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id,
    1 - (d.embedding <=> query_embedding) AS score,
    d.metadata,
    d.embedding
  FROM public.ai_tools_vectors d
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER TABLE public.ai_tools_vectors ENABLE ROW LEVEL SECURITY;

-- Local integration: service_role bypasses RLS; allow authenticated/anon for simplicity in tests
CREATE POLICY "ai_tools_vectors_all_service"
  ON public.ai_tools_vectors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE public.ai_tools_vectors TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_vectors(extensions.vector, int, jsonb, text)
  TO postgres, anon, authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ai-tools-it', 'ai-tools-it', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ai_tools_storage_service"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'ai-tools-it')
  WITH CHECK (bucket_id = 'ai-tools-it');
