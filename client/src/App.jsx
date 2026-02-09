import { useSearch } from "./hooks/useSearch";
import SearchBar from "./components/SearchBar";
import HerbCardList from "./components/HerbCardList";
import LoadingSpinner from "./components/LoadingSpinner";
import EmptyState from "./components/EmptyState";
import "./App.css";

export default function App() {
  const { results, loading, error, hasSearched, search } = useSearch();

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">The Apothecary</h1>
        <p className="app-subtitle">Discover herbs for what ails you</p>
      </header>

      <main className="app-main">
        <SearchBar onSearch={search} loading={loading} />

        {error && <p className="error-message">{error}</p>}

        {loading && <LoadingSpinner />}

        {!loading && results.length > 0 && (
          <HerbCardList results={results} />
        )}

        {!loading && results.length === 0 && (
          <EmptyState hasSearched={hasSearched} />
        )}
      </main>
    </div>
  );
}
