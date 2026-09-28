import { useSearch } from "../hooks/useSearch";
import SearchBar from "../components/SearchBar";
import HerbCardList from "../components/HerbCardList";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";

export default function HomePage() {
  const { herbs, loading, error, hasSearched, search } = useSearch();

  return (
    <>
      <SearchBar onSearch={search} loading={loading} />

      {error && <p className="error-message">{error}</p>}

      {loading && <LoadingSpinner />}

      {!loading && herbs.length > 0 && <HerbCardList results={herbs} />}

      {!loading && herbs.length === 0 && !error && (
        <EmptyState hasSearched={hasSearched} onSearch={search} />
      )}
    </>
  );
}
