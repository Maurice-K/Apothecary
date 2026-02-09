import "dotenv/config";
import { readFileSync } from "fs";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const herbs = JSON.parse(readFileSync("chioma_products.json", "utf-8"));

console.log(`Embedding ${herbs.length} herbs...`);

// Generate embeddings in a single batch
const inputs = herbs.map((h) => `${h.name}: ${h.description}`);
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
  embedding: embeddingData[i].embedding,
}));

console.log(`Upserting ${rows.length} rows to Supabase...`);

const { error } = await supabase.from("herbs").upsert(rows, {
  onConflict: "name",
});

if (error) {
  console.error("Upsert failed:", error);
  process.exit(1);
}

console.log(`Done. ${rows.length} herbs ingested successfully.`);
