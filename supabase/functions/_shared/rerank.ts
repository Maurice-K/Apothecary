import type { Herb } from "./types.ts";

const apiKey = Deno.env.get("COHERE_API_KEY");
if (!apiKey) {
  console.warn("[rerank] COHERE_API_KEY is not set; herb search falls back to cosine order");
}

const RERANK_URL = "https://api.cohere.com/v2/rerank";
const RERANK_MODEL = "rerank-v4.0-fast";
const RERANK_TIMEOUT_MS = 2000;

// Mirrors buildEmbeddingInput in scripts/ingest.js so the reranker scores the
// same labeled text the embeddings were built from. how_to_use is left out for
// the same reason: brewing prose dilutes the signal.
function herbDocument(herb: Herb): string {
  const lines = [herb.botanical_name ? `${herb.name} (${herb.botanical_name})` : herb.name];
  if (herb.tags?.length) lines.push(`Properties: ${herb.tags.join(", ")}`);
  if (herb.category?.length) lines.push(`Use cases: ${herb.category.join(", ")}`);
  if (herb.energetics?.length) lines.push(`Energetics: ${herb.energetics.join(", ")}`);
  if (herb.plant_part) lines.push(`Plant part: ${herb.plant_part}`);
  lines.push(herb.description);
  return lines.join("\n");
}

// Re-scores cosine candidates with Cohere Rerank and returns the top `topN`
// with a `relevance` score. Any failure (no key, HTTP error, timeout) falls
// back to the incoming cosine order so search never breaks on the reranker.
export async function rerankHerbs(query: string, herbs: Herb[], topN: number): Promise<Herb[]> {
  if (!apiKey || herbs.length === 0) return herbs.slice(0, topN);

  try {
    const res = await fetch(RERANK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: RERANK_MODEL,
        query,
        documents: herbs.map(herbDocument),
        top_n: topN,
      }),
      signal: AbortSignal.timeout(RERANK_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

    const { results } = (await res.json()) as {
      results: { index: number; relevance_score: number }[];
    };
    return results.map((r) => ({ ...herbs[r.index], relevance: r.relevance_score }));
  } catch (err) {
    console.warn("[rerank] falling back to cosine order:", err instanceof Error ? err.message : err);
    return herbs.slice(0, topN);
  }
}
