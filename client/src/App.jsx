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
        <div className="app-header-ornament" aria-hidden="true">
          <span className="ornament-line"></span>
          <span className="ornament-leaf">&#x2E19;</span>
          <span className="ornament-line"></span>
        </div>
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
          <EmptyState hasSearched={hasSearched} onSearch={search} />
        )}
      </main>

      {/* <footer className="app-footer">
        <span className="footer-ornament" aria-hidden="true">&#x2E19;</span>
        <p>134 herbs &middot; Powered by semantic search</p>
      </footer> */}
    </div>
  );
}
