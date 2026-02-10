import { useState } from "react";
import "./HerbCard.css";

export default function HerbCard({ herb }) {
  const [expanded, setExpanded] = useState(false);
  const matchPercent = Math.round(herb.similarity * 100);

  return (
    <article className="herb-card">
      <div className="herb-card-header">
        <h3 className="herb-name">{herb.name}</h3>
        <span className="similarity-badge" title={`${matchPercent}% semantic match`}>
          {matchPercent}%
        </span>
      </div>

      <p className="herb-description">{herb.description}</p>

      <button
        className={`how-to-use-toggle ${expanded ? "is-expanded" : ""}`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <svg
          className="toggle-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {expanded ? "Hide preparation" : "How to prepare"}
      </button>

      {expanded && (
        <div className="herb-how-to-use">
          <p>{herb.how_to_use}</p>
        </div>
      )}

      <div className="herb-categories">
        {herb.category.map((cat) => (
          <span key={cat} className="category-tag">
            {cat}
          </span>
        ))}
      </div>
    </article>
  );
}
