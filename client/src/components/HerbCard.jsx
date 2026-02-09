import { useState } from "react";
import "./HerbCard.css";

export default function HerbCard({ herb }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="herb-card">
      <div className="herb-card-header">
        <h3 className="herb-name">{herb.name}</h3>
        <span className="similarity-badge">
          {Math.round(herb.similarity * 100)}% match
        </span>
      </div>

      <p className="herb-description">{herb.description}</p>

      <button
        className="how-to-use-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide" : "How to use"}
      </button>

      {expanded && (
        <p className="herb-how-to-use">{herb.how_to_use}</p>
      )}

      <div className="herb-categories">
        {herb.category.map((cat) => (
          <span key={cat} className="category-tag">
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
}
