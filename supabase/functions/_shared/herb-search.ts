import { generateEmbedding } from "./embedding.ts";
import { rerankHerbs } from "./rerank.ts";
import { supabaseAdmin } from "./supabase.ts";
import type { Herb } from "./types.ts";

const MATCH_THRESHOLD = 0.3;
// Cosine candidates handed to the reranker. The catalog is small (156 herbs),
// so a wide pool is cheap and lets the reranker surface herbs the embedding
// ranked low.
const CANDIDATE_COUNT = 25;

// "Herb for " stem pulls bare keywords ("energy", "sleep") closer to the
// herb document embeddings, which are themselves about herbs. The reranker
// reads query and document together, so it gets the raw query (the stem
// ranked slightly worse there).
export async function searchHerbs(query: string, limit: number): Promise<Herb[]> {
  const queryEmbedding = await generateEmbedding(`Herb for ${query}`);
  const { data, error } = await supabaseAdmin.rpc("match_herbs", {
    query_embedding: queryEmbedding,
    match_threshold: MATCH_THRESHOLD,
    match_count: Math.max(limit, CANDIDATE_COUNT),
  });
  if (error) throw error;
  return rerankHerbs(query, (data ?? []) as Herb[], limit);
}
