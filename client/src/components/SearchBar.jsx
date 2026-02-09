import { useState } from "react";
import "./SearchBar.css";

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(query);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for herbs... e.g. &quot;what helps with sleep?&quot;"
        disabled={loading}
      />
      <button type="submit" disabled={loading || !query.trim()}>
        {loading ? "Searching..." : "Search"}
      </button>
    </form>
  );
}
