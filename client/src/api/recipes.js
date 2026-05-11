import { supabase } from "./supabaseClient";

export async function createRecipe(data) {
  const { data: result, error } = await supabase.functions.invoke("recipes", {
    method: "POST",
    body: data,
  });

  if (error) throw error;
  return result.recipe;
}

export async function updateRecipe(id, data) {
  const { data: result, error } = await supabase.functions.invoke(
    `recipes?id=${id}`,
    { method: "PUT", body: data }
  );

  if (error) throw error;
  return result.recipe;
}

export async function deleteRecipe(id) {
  const { error } = await supabase.functions.invoke(
    `recipes?id=${id}`,
    { method: "DELETE" }
  );

  if (error) throw error;
}

export async function fetchMyRecipes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchRecipeById(id) {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export function getPhotoUrl(path) {
  const { data } = supabase.storage.from("recipe-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadRecipePhoto(userId, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("recipe-photos")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;
  return path;
}
