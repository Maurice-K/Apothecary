/** Herb record from the herbs table */
export interface Herb {
  id: number;
  name: string;
  description: string;
  how_to_use: string;
  category: string[];
  tags: string[] | null;
  energetics: string[] | null;
  botanical_name: string | null;
  plant_part: string | null;
  origin: string | null;
  form: string | null;
  similarity: number;
}

/** Recipe record from the recipes table */
export interface Recipe {
  id: number;
  user_id: string;
  name: string;
  ingredients: string[];
  instructions: string;
  prep_time: number | null;
  photo_path: string | null;
  embedding_status: string;
  created_at: string;
  updated_at: string;
}

/** Recipe as returned from match_recipes RPC (no embedding, includes similarity) */
export interface RecipeSearchResult {
  id: number;
  user_id: string;
  name: string;
  ingredients: string[];
  instructions: string;
  prep_time: number | null;
  photo_path: string | null;
  similarity: number;
}

/** Request body for search endpoints */
export interface SearchRequest {
  query: string;
  limit?: number;
}

/** Request body for creating a recipe */
export interface CreateRecipeRequest {
  name: string;
  ingredients: string[];
  instructions: string;
  prep_time?: number | null;
}

/** Request body for updating a recipe */
export interface UpdateRecipeRequest {
  name?: string;
  ingredients?: string[];
  instructions?: string;
  prep_time?: number | null;
}

/** Standard error response */
export interface ErrorResponse {
  error: string;
}

/** Single message in a nutritionist chat conversation (client view). */
export interface NutritionistMessage {
  role: "user" | "assistant";
  content: string;
}

/** Request body for the nutritionist Edge Function. */
export interface NutritionistRequest {
  messages: NutritionistMessage[];
}
