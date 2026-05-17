import "@supabase/functions-js/edge-runtime.d.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { searchHerbs } from "../_shared/herb-search.ts";
import { validateSearchRequest, ValidationError } from "../_shared/validation.ts";
import type { Herb } from "../_shared/types.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { query, limit = 8 } = validateSearchRequest(await req.json());
    const results = await searchHerbs(query, limit);
    return jsonResponse<{ results: Herb[] }>(req, { results });
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse(req, err, 400);
    return errorResponse(req, err);
  }
});
