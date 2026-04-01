import { useState, useCallback } from "react";
import { searchHerbs, searchAll, type RecipeResult, type SearchResults } from "../api/search";

export function useSearch() {
  const [results, setResults] = useState<SearchResults>({ herbs: [], recipes: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [herbResult, recipeResult] = await Promise.allSettled([
        searchHerbs(query),
        searchAll(query).then((d) => d.recipes),
      ]);

      setResults({
        herbs: herbResult.status === "fulfilled" ? herbResult.value : [],
        recipes: recipeResult.status === "fulfilled" ? recipeResult.value : [],
      });
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, hasSearched, search };
}
