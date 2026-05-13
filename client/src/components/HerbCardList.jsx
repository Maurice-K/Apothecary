import HerbCard from "./HerbCard";
import "./HerbCardList.css";

export default function HerbCardList({ results }) {
  return (
    <section className="herb-card-list">
      <p className="results-count">
        {results.length} herb{results.length !== 1 ? "s" : ""} found
      </p>
      <div className="herb-card-list-items">
        {results.map((herb, index) => (
          <HerbCard key={herb.id} herb={herb} index={index} />
        ))}
      </div>
    </section>
  );
}
