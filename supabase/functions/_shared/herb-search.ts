import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { generateEmbedding } from "./embedding.ts";
import { supabaseAdmin } from "./supabase.ts";
import type { Herb } from "./types.ts";

const MATCH_THRESHOLD = 0.3;

// "Herb for " stem pulls bare keywords ("energy", "sleep") closer to the
// herb document embeddings, which are themselves about herbs.
export async function searchHerbs(
  query: string,
  limit: number,
  client: SupabaseClient = supabaseAdmin,
): Promise<Herb[]> {
  const queryEmbedding = await generateEmbedding(`Herb for ${query}`);
  const { data, error } = await client.rpc("match_herbs", {
    query_embedding: queryEmbedding,
    match_threshold: MATCH_THRESHOLD,
    match_count: limit,
  });
  if (error) throw error;
  return (data ?? []) as Herb[];
}
