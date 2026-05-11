import { supabase } from "./supabaseClient";

export interface HerbResult {
  id: number;
  name: string;
  description: string;
  how_to_use: string;
  category: string[];
  similarity: number;
}

export interface RecipeResult {
  id: number;
  user_id: string;
  name: string;
  ingredients: string[];
  instructions: string;
  prep_time: number | null;
  photo_path: string | null;
  similarity: number;
}

export interface SearchResults {
  herbs: HerbResult[];
  recipes: RecipeResult[];
}

export async function searchAll(query: string, limit = 8): Promise<SearchResults> {
  const { data, error } = await supabase.functions.invoke("recipes-search", {
    body: { query, limit },
  });

  if (error) throw error;
  return data as SearchResults;
}

export async function searchHerbs(query: string, limit = 8): Promise<HerbResult[]> {
  const { data, error } = await supabase.functions.invoke("search", {
    body: { query, limit },
  });

  if (error) throw error;
  return (data as { results: HerbResult[] }).results;
}
