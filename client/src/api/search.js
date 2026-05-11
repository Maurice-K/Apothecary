import { supabase } from "./supabaseClient";

export async function searchHerbs(query, limit = 8) {
  const { data, error } = await supabase.functions.invoke("search", {
    body: { query, limit },
  });

  if (error) throw error;
  return data.results;
}

export async function searchAll(query, limit = 8) {
  const { data, error } = await supabase.functions.invoke("recipes-search", {
    body: { query, limit },
  });

  if (error) throw error;
  return { herbs: data.herbs, recipes: data.recipes };
}
