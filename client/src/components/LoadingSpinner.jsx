import "./LoadingSpinner.css";

export default function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <div className="spinner-dots">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
      <p>Searching the apothecary...</p>
    </div>
  );
}
