import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth.jsx";
import NavBar from "./components/NavBar";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import MyRecipesPage from "./pages/MyRecipesPage";
import AddRecipePage from "./pages/AddRecipePage";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <header className="app-header">
          <div className="app-header-ornament" aria-hidden="true">
            <span className="ornament-line"></span>
            <span className="ornament-leaf">&#x2E19;</span>
            <span className="ornament-line"></span>
          </div>
          <h1 className="app-title">The Herbary</h1>
          <p className="app-subtitle">Discover herbs for what ails you</p>
        </header>

        <NavBar />

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/recipe/:id" element={<RecipeDetailPage />} />
            <Route path="/my-recipes" element={<MyRecipesPage />} />
            <Route path="/add-recipe" element={<AddRecipePage />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
