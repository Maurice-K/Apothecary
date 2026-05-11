import { useState } from "react";
import { useSearch } from "../hooks/useSearch";
import SearchBar from "../components/SearchBar";
import HerbCardList from "../components/HerbCardList";
import RecipeCardList from "../components/RecipeCardList";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";

export default function HomePage() {
  const { herbs, recipes, loading, error, hasSearched, search } = useSearch();
  const [activeTab, setActiveTab] = useState("herbs");

  return (
    <>
      <SearchBar onSearch={search} loading={loading} />

      {error && <p className="error-message">{error}</p>}

      {loading && <LoadingSpinner />}

      {!loading && hasSearched && (
        <>
          <div className="search-tabs">
            <button
              className={`search-tab ${activeTab === "herbs" ? "search-tab-active" : ""}`}
              onClick={() => setActiveTab("herbs")}
            >
              Herbs ({herbs.length})
            </button>
            <button
              className={`search-tab ${activeTab === "recipes" ? "search-tab-active" : ""}`}
              onClick={() => setActiveTab("recipes")}
            >
              Recipes ({recipes.length})
            </button>
          </div>

          {activeTab === "herbs" && herbs.length > 0 && (
            <HerbCardList results={herbs} />
          )}

          {activeTab === "recipes" && recipes.length > 0 && (
            <RecipeCardList recipes={recipes} />
          )}

          {activeTab === "herbs" && herbs.length === 0 && (
            <p className="no-results">No herbs found.</p>
          )}

          {activeTab === "recipes" && recipes.length === 0 && (
            <p className="no-results">No recipes found.</p>
          )}
        </>
      )}

      {!loading && !hasSearched && (
        <EmptyState hasSearched={hasSearched} onSearch={search} />
      )}
    </>
  );
}
