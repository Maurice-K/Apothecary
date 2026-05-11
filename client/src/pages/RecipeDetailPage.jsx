import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchRecipeById, getPhotoUrl } from "../api/recipes";
import "./RecipeDetailPage.css";

export default function RecipeDetailPage() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecipeById(id)
      .then(setRecipe)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="loading-text">Loading...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!recipe) return <p className="error-message">Recipe not found</p>;

  return (
    <div className="recipe-detail">
      {recipe.photo_path && (
        <img
          className="recipe-detail-photo"
          src={getPhotoUrl(recipe.photo_path)}
          alt={recipe.name}
        />
      )}

      <h2 className="recipe-detail-title">{recipe.name}</h2>

      {recipe.prep_time && (
        <p className="recipe-detail-meta">{recipe.prep_time} minutes</p>
      )}

      <h3 className="recipe-detail-section">Ingredients</h3>
      <ul className="recipe-detail-ingredients">
        {recipe.ingredients.map((ing, i) => (
          <li key={i}>{ing}</li>
        ))}
      </ul>

      <h3 className="recipe-detail-section">Instructions</h3>
      <p className="recipe-detail-instructions">{recipe.instructions}</p>

      <Link to="/" className="recipe-detail-back">Back to search</Link>
    </div>
  );
}
