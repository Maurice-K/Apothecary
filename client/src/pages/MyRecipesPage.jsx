import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { fetchMyRecipes, deleteRecipe } from "../api/recipes";
import "./MyRecipesPage.css";

export default function MyRecipesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchMyRecipes()
      .then(setRecipes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, navigate]);

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteRecipe(id);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <p className="loading-text">Loading...</p>;

  return (
    <div className="my-recipes">
      <div className="my-recipes-header">
        <h2 className="my-recipes-title">My Recipes</h2>
        <Link to="/add-recipe" className="my-recipes-add">+ Add Recipe</Link>
      </div>

      {recipes.length === 0 ? (
        <p className="my-recipes-empty">No recipes yet. Create your first one!</p>
      ) : (
        <div className="my-recipes-list">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="my-recipe-item">
              <Link to={`/recipe/${recipe.id}`} className="my-recipe-info">
                <span className="my-recipe-name">{recipe.name}</span>
                <span className="my-recipe-meta">
                  {recipe.ingredients.length} ingredients
                  {recipe.prep_time ? ` · ${recipe.prep_time} min` : ""}
                </span>
              </Link>
              <button
                className="my-recipe-delete"
                onClick={() => handleDelete(recipe.id, recipe.name)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
