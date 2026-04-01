import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { generateEmbedding } from "../_shared/embedding.ts";
import { validateSearchRequest, ValidationError } from "../_shared/validation.ts";
import type { Herb, RecipeSearchResult } from "../_shared/types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const { query, limit = 8 } = validateSearchRequest(body);

    const queryEmbedding = await generateEmbedding(query);

    const [herbResult, recipeResult] = await Promise.all([
      supabase.rpc("match_herbs", {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: limit,
      }),
      supabase.rpc("match_recipes", {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: limit,
      }),
    ]);

    if (herbResult.error) throw herbResult.error;
    if (recipeResult.error) throw recipeResult.error;

    return jsonResponse<{ herbs: Herb[]; recipes: RecipeSearchResult[] }>(req, {
      herbs: herbResult.data ?? [],
      recipes: recipeResult.data ?? [],
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(req, err, 400);
    }
    return errorResponse(req, err);
  }
});
