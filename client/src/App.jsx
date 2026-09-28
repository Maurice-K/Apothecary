import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import HomePage from "./pages/HomePage";
import NutritionistPage from "./pages/Nutritionist";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-frame">
          <div className="app-header-ornament" aria-hidden="true">
            <span className="ornament-line"></span>
            <span className="ornament-dot">⁙</span>
            <span className="ornament-line"></span>
          </div>
          <h1 className="app-title">The Herbary</h1>
          <div className="app-header-divider" aria-hidden="true"></div>
          <p className="app-subtitle">Discover herbs for what ails you</p>
          <p className="app-tagline">Est. 2026 · Botanical Wellness · AI Guided</p>
        </div>
      </header>

      <NavBar />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<NutritionistPage />} />
          <Route path="/herb-search" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
