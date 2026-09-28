import { supabase } from "./supabaseClient";

export async function searchHerbs(query, limit = 8) {
  const { data, error } = await supabase.functions.invoke("search", {
    body: { query, limit },
  });

  if (error) throw error;
  return data.results;
}
