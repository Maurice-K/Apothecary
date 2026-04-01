import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { generateEmbedding } from "../_shared/embedding.ts";
import {
  validateCreateRecipeRequest,
  validateUpdateRecipeRequest,
  ValidationError,
} from "../_shared/validation.ts";

const DAILY_RECIPE_LIMIT = 10;

function createAuthClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new ValidationError("Authorization header required");

  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

async function getAuthUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ValidationError("Unauthorized");
  return user;
}

async function handleCreate(req: Request): Promise<Response> {
  const supabase = createAuthClient(req);
  const user = await getAuthUser(supabase);

  const body = await req.json();
  const recipe = validateCreateRecipeRequest(body);

  // Rate limiting: check daily recipe count
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", `${today}T00:00:00Z`);

  if ((count ?? 0) >= DAILY_RECIPE_LIMIT) {
    return jsonResponse(req, { error: "Daily recipe limit reached (10 per day)" }, 429);
  }

  const embeddingInput = `${recipe.name}: ${recipe.ingredients.join(", ")}`;
  let embedding: number[] | null = null;
  let embeddingStatus = "pending";

  try {
    embedding = await generateEmbedding(embeddingInput);
    embeddingStatus = "complete";
  } catch {
    embeddingStatus = "failed";
  }

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: user.id,
      name: recipe.name,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time,
      embedding,
      embedding_status: embeddingStatus,
    })
    .select()
    .single();

  if (error) throw error;

  return jsonResponse(req, { recipe: data }, 201);
}

async function handleUpdate(req: Request): Promise<Response> {
  const supabase = createAuthClient(req);
  const user = await getAuthUser(supabase);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonResponse(req, { error: "id query parameter required" }, 400);

  const body = await req.json();
  const updates = validateUpdateRecipeRequest(body);

  // If name or ingredients changed, regenerate embedding
  if (updates.name || updates.ingredients) {
    // Fetch current recipe to merge fields for embedding
    const { data: current } = await supabase
      .from("recipes")
      .select("name, ingredients")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!current) return jsonResponse(req, { error: "Recipe not found" }, 404);

    const name = updates.name ?? current.name;
    const ingredients = updates.ingredients ?? current.ingredients;
    const embeddingInput = `${name}: ${ingredients.join(", ")}`;

    try {
      const embedding = await generateEmbedding(embeddingInput);
      Object.assign(updates, { embedding, embedding_status: "complete" });
    } catch {
      Object.assign(updates, { embedding: null, embedding_status: "failed" });
    }
  }

  const { data, error } = await supabase
    .from("recipes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  if (!data) return jsonResponse(req, { error: "Recipe not found" }, 404);

  return jsonResponse(req, { recipe: data });
}

async function handleDelete(req: Request): Promise<Response> {
  const supabase = createAuthClient(req);
  const user = await getAuthUser(supabase);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonResponse(req, { error: "id query parameter required" }, 400);

  const { data: recipe } = await supabase
    .from("recipes")
    .select("photo_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!recipe) return jsonResponse(req, { error: "Recipe not found" }, 404);

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  if (recipe.photo_path) {
    await supabase.storage.from("recipe-photos").remove([recipe.photo_path]);
  }

  return jsonResponse(req, { success: true });
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    switch (req.method) {
      case "POST":
        return await handleCreate(req);
      case "PUT":
        return await handleUpdate(req);
      case "DELETE":
        return await handleDelete(req);
      default:
        return jsonResponse(req, { error: "Method not allowed" }, 405);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(req, err, 400);
    }
    return errorResponse(req, err);
  }
});
