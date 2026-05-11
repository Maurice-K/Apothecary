import { useState } from "react";
import { searchHerbs, searchAll } from "../api/search";

export function useSearch() {
  const [herbs, setHerbs] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function search(query) {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const [herbResult, recipeResult] = await Promise.allSettled([
        searchHerbs(query),
        searchAll(query).then((d) => d.recipes),
      ]);

      setHerbs(herbResult.status === "fulfilled" ? herbResult.value : []);
      setRecipes(recipeResult.status === "fulfilled" ? recipeResult.value : []);
      setHasSearched(true);
    } catch (err) {
      setError(err.message || "Search failed");
      setHerbs([]);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }

  return { herbs, recipes, loading, error, hasSearched, search };
}
