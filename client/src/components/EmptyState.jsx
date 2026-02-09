import "./EmptyState.css";

export default function EmptyState({ hasSearched }) {
  if (hasSearched) {
    return (
      <div className="empty-state">
        <p className="empty-state-message">
          No herbs matched your search. Try a different query.
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <h2 className="empty-state-title">Welcome to the Apothecary</h2>
      <p className="empty-state-message">
        Search our collection of 134 bulk herbs using plain English.
        Try queries like "what helps with sleep?" or "herbs for digestion".
      </p>
    </div>
  );
}
