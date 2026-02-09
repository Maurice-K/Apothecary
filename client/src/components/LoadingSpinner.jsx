import "./LoadingSpinner.css";

export default function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Searching the apothecary...</p>
    </div>
  );
}
