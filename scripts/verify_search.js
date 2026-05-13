#!/usr/bin/env node
// Probes the live match_herbs RPC with the partner's failure queries.
// Simulates the Edge Function path: generate "Herb for {query}" embedding, then
// call match_herbs directly. Prints the top-5 herbs + similarity per query.

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

async function embed(text) {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: "Herb for " + text,
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
      match_count: 5,
    }),
  });
  if (!res.ok) {
    console.error(`Search failed: HTTP ${res.status}`, await res.text());
    return [];
  }
  return res.json();
}

for (const q of QUERIES) {
  const results = await search(q);
  console.log(`\n=== "${q}" ===`);
  if (!results.length) {
    console.log("  (no results above threshold)");
    continue;
  }
  for (const r of results) {
    const tags = r.tags?.length ? ` [${r.tags.slice(0, 3).join(", ")}]` : "";
    console.log(`  ${r.similarity.toFixed(3)}  ${r.name}${tags}`);
  }
}
