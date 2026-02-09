import HerbCard from "./HerbCard";
import "./HerbCardList.css";

export default function HerbCardList({ results }) {
  return (
    <div className="herb-card-list">
      {results.map((herb) => (
        <HerbCard key={herb.id} herb={herb} />
      ))}
    </div>
  );
}
