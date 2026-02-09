import { useState } from "react";
import { searchHerbs } from "../api/search";

export function useSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function search(query) {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await searchHerbs(query);
      setResults(data);
      setHasSearched(true);
    } catch (err) {
      setError(err.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return { results, loading, error, hasSearched, search };
}
