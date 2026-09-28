import { useState } from "react";
import { searchHerbs } from "../api/search";

export function useSearch() {
  const [herbs, setHerbs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function search(query) {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      setHerbs(await searchHerbs(query));
      setHasSearched(true);
    } catch (err) {
      setError(err.message || "Search failed");
      setHerbs([]);
    } finally {
      setLoading(false);
    }
  }

  return { herbs, loading, error, hasSearched, search };
}
