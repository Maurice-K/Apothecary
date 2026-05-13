import { useState } from "react";
import "./HerbCard.css";

// Extract a Latin name in parentheses from the start of the description
// e.g. "Hyssop Herb (Hyssop officinalis), a member..." → "Hyssop officinalis"
function extractLatinName(name, description) {
  if (!description) return null;
  // Match "(Two Word Name)" anywhere near the start of the description
  const match = description.match(/\(([A-Z][a-z]+ [a-z]+(?:\s[a-z]+)?)\)/);
  if (match) return match[1];
  return null;
}

export default function HerbCard({ herb, index }) {
  const [expanded, setExpanded] = useState(false);
  const matchPercent = Math.round(herb.similarity * 100);
  const cardNumber = String(index + 1).padStart(2, "0");
  const latinName = extractLatinName(herb.name, herb.description);

  return (
    <article className="herb-card">
      {/* Faint watermark number in top-right */}
      <span className="herb-card-number" aria-hidden="true">{cardNumber}</span>

      <div className="herb-card-header">
        <h3 className="herb-name">{herb.name}</h3>
        <span className="similarity-badge" title={`${matchPercent}% semantic match`}>
          {matchPercent}% match
        </span>
      </div>

      {/* Latin name shown as italic quote below header, if extractable */}
      {latinName && (
        <p className="herb-latin-name">"{latinName}"</p>
      )}

      <p className="herb-description">{herb.description}</p>

      <div className="herb-categories">
        {herb.category.map((cat) => (
          <span key={cat} className="category-tag">
            {cat}
          </span>
        ))}
      </div>

      {/* Traditional Preparation — italic terracotta link at bottom of card */}
      {herb.how_to_use && (
        <>
          <button
            className={`traditional-prep-toggle ${expanded ? "is-expanded" : ""}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? "Hide preparation" : "Traditional Preparation"}
            <span className="prep-arrow" aria-hidden="true">{expanded ? "↑" : "→"}</span>
          </button>

          {expanded && (
            <div className="herb-how-to-use">
              <p>{herb.how_to_use}</p>
            </div>
          )}
        </>
      )}
    </article>
  );
}
