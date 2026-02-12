import "./EmptyState.css";

const SUGGESTIONS = [
  "what helps with sleep?",
  "herbs for digestion",
  "immunity boost",
  "stress and anxiety",
  "something for my skin",
  "liver support",
];

export default function EmptyState({ hasSearched, onSearch }) {
  if (hasSearched) {
    return (
      <div className="empty-state">
        <p className="empty-state-icon" aria-hidden="true">&#x2698;</p>
        <p className="empty-state-message">
          No herbs matched your search. Try a different query.
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <h2 className="empty-state-title">Welcome to the Herbary</h2>
      <p className="empty-state-message">
        Search our collection of bulk herbs using plain English.
        Describe what you need and we'll find the right remedy.
      </p>
      <div className="suggestion-chips">
        <p className="suggestion-label">Try searching for:</p>
        <div className="chips">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              className="chip"
              onClick={() => onSearch(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
