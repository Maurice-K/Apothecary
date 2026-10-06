#!/usr/bin/env node
// Probes the live match_herbs RPC with the partner's failure queries.
// Simulates the Edge Function path: generate "Herb for {query}" embedding, call
// match_herbs directly for 25 candidates, then rerank them with Cohere. Prints
// the cosine top-5 next to the reranked top-5 per query.
//
// Keep in sync with the Edge Functions: the stem (embedding only; the reranker
// gets the raw query) and candidate count mirror _shared/herb-search.ts; the
// rerank model and document format mirror _shared/rerank.ts (which mirrors
// buildEmbeddingInput in ingest.js).

import dotenv from "dotenv";
import OpenAI from "openai";

// `node scripts/verify_search.js`        -> local
// `node scripts/verify_search.js prod`   -> remote
const target = process.argv[2] === "prod" ? "prod" : "local";
if (target === "local") {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
} else {
  dotenv.config();
}
console.log(`Target: ${target.toUpperCase()} (${process.env.SUPABASE_URL})\n`);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const CANDIDATE_COUNT = 25;
const RERANK_MODEL = "rerank-v4.0-fast";
const SHOW = 5;

const QUERIES = [
  "headache",
  "sore throat",
  "period cramps",
  "energy",
  "sleep",
  "digestion",
  "safe for pregnancy",
  "cooling herbs",
];

function herbDocument(h) {
  const lines = [h.botanical_name ? `${h.name} (${h.botanical_name})` : h.name];
  if (h.tags?.length)       lines.push(`Properties: ${h.tags.join(", ")}`);
  if (h.category?.length)   lines.push(`Use cases: ${h.category.join(", ")}`);
  if (h.energetics?.length) lines.push(`Energetics: ${h.energetics.join(", ")}`);
  if (h.plant_part)         lines.push(`Plant part: ${h.plant_part}`);
  lines.push(h.description);
  return lines.join("\n");
}

async function embed(text) {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return data[0].embedding;
}

async function search(query) {
  const embedding = await embed(query);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_herbs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: CANDIDATE_COUNT,
    }),
  });
  if (!res.ok) {
    console.error(`Search failed: HTTP ${res.status}`, await res.text());
    return [];
  }
  return res.json();
}

async function rerank(query, herbs) {
  const res = await fetch("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents: herbs.map(herbDocument),
      top_n: SHOW,
    }),
  });
  if (!res.ok) {
    console.error(`Rerank failed: HTTP ${res.status}`, await res.text());
    return [];
  }
  const { results } = await res.json();
  return results.map((r) => ({ ...herbs[r.index], relevance: r.relevance_score }));
}

const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));

if (!COHERE_API_KEY) console.warn("COHERE_API_KEY is not set; skipping rerank column\n");

for (const q of QUERIES) {
  const candidates = await search("Herb for " + q);
  console.log(`\n=== "${q}" (${candidates.length} candidates) ===`);
  if (!candidates.length) {
    console.log("  (no results above threshold)");
    continue;
  }
  const reranked = COHERE_API_KEY ? await rerank(q, candidates) : [];
  console.log(`  ${pad("cosine", 38)}  reranked`);
  for (let i = 0; i < SHOW; i++) {
    const c = candidates[i];
    const r = reranked[i];
    const left = c ? `${c.similarity.toFixed(3)}  ${c.name}` : "";
    const right = r ? `rel ${r.relevance.toFixed(2)} · cos ${r.similarity.toFixed(2)} · ${r.name}` : "";
    console.log(`  ${pad(left, 38)}  ${right}`);
  }
}
