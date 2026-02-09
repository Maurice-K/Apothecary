import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { query, limit = 8 } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate embedding for the search query
    const { data: embeddingData } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = embeddingData[0].embedding;

    // Search for matching herbs via pgvector cosine similarity
    const { data: results, error } = await supabase.rpc("match_herbs", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: limit,
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ results }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
