import { supabase } from "./supabaseClient";
import { decode } from "base64-arraybuffer";

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

export async function createRecipe(data: {
  name: string;
  ingredients: string[];
  instructions: string;
  prep_time?: number | null;
}): Promise<Recipe> {
  const { data: result, error } = await supabase.functions.invoke("recipes", {
    method: "POST",
    body: data,
  });

  if (error) throw error;
  return (result as { recipe: Recipe }).recipe;
}

export async function updateRecipe(
  id: number,
  data: {
    name?: string;
    ingredients?: string[];
    instructions?: string;
    prep_time?: number | null;
  }
): Promise<Recipe> {
  const { data: result, error } = await supabase.functions.invoke(
    `recipes?id=${id}`,
    { method: "PUT", body: data }
  );

  if (error) throw error;
  return (result as { recipe: Recipe }).recipe;
}

export async function deleteRecipe(id: number): Promise<void> {
  const { error } = await supabase.functions.invoke(
    `recipes?id=${id}`,
    { method: "DELETE" }
  );

  if (error) throw error;
}

export async function uploadRecipePhoto(
  userId: string,
  base64Data: string,
  mimeType = "image/jpeg"
): Promise<string> {
  const ext = mimeType.split("/")[1] || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("recipe-photos")
    .upload(path, decode(base64Data), {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;
  return path;
}

export function getPhotoUrl(path: string): string {
  const { data } = supabase.storage.from("recipe-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchRecipeById(id: string): Promise<Recipe> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Recipe;
}

export async function fetchMyRecipes(): Promise<Recipe[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Recipe[];
}
