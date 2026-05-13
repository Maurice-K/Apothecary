import dotenv from "dotenv";
// Ingest always targets the remote/production DB defined in .env.
// .env.local is a developer override for the Edge Function dev loop and would
// otherwise route this script at the local Supabase stack.
dotenv.config();
import { readFileSync } from "fs";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const herbs = JSON.parse(readFileSync("chioma_products.json", "utf-8"));

console.log(`Embedding ${herbs.length} herbs...`);

// Order matters: high-signal labels first (tags, category, energetics) so they
// aren't drowned by the long prose description. text-embedding-3-small handles
// up to 8191 tokens, so no truncation needed.
function buildEmbeddingInput(h) {
  const lines = [];
  lines.push(h.botanical_name ? `${h.name} (${h.botanical_name})` : h.name);
  if (h.tags?.length)       lines.push(`Properties: ${h.tags.join(", ")}`);
  if (h.category?.length)   lines.push(`Use cases: ${h.category.join(", ")}`);
  if (h.energetics?.length) lines.push(`Energetics: ${h.energetics.join(", ")}`);
  if (h.plant_part)         lines.push(`Plant part: ${h.plant_part}`);
  lines.push(h.description);
  return lines.join("\n");
}

const inputs = herbs.map(buildEmbeddingInput);
const { data: embeddingData } = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: inputs,
});

// Prepare rows for upsert
const rows = herbs.map((herb, i) => ({
  name: herb.name,
  description: herb.description,
  how_to_use: herb.how_to_use,
  category: herb.category,
  tags: herb.tags ?? null,
  energetics: herb.energetics ?? null,
  botanical_name: herb.botanical_name ?? null,
  plant_part: herb.plant_part ?? null,
  origin: herb.origin ?? null,
  form: herb.form ?? null,
  embedding: embeddingData[i].embedding,
}));

// Upsert in batches via PostgREST directly. The supabase-js SDK was hitting a
// stale column cache on this project even after schema reload; raw fetch with
// the same Prefer header works reliably.
const BATCH_SIZE = 25;
console.log(`Upserting ${rows.length} rows to Supabase in batches of ${BATCH_SIZE}...`);

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/herbs?on_conflict=name`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Upsert batch ${i / BATCH_SIZE + 1} failed (HTTP ${res.status}):`, body);
    process.exit(1);
  }
  process.stdout.write(`  upserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
}

console.log(`\nDone. ${rows.length} herbs ingested successfully.`);
