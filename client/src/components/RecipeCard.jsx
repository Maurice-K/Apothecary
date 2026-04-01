import { Link } from "react-router-dom";
import { getPhotoUrl } from "../api/recipes";
import "./RecipeCard.css";

export default function RecipeCard({ recipe }) {
  return (
    <Link to={`/recipe/${recipe.id}`} className="recipe-card">
      {recipe.photo_path && (
        <img
          className="recipe-card-photo"
          src={getPhotoUrl(recipe.photo_path)}
          alt={recipe.name}
          loading="lazy"
        />
      )}
      <div className="recipe-card-body">
        <h3 className="recipe-card-title">{recipe.name}</h3>
        <p className="recipe-card-meta">
          {recipe.ingredients.length} ingredients
          {recipe.prep_time ? ` · ${recipe.prep_time} min` : ""}
        </p>
        <p className="recipe-card-description">
          {recipe.instructions.slice(0, 120)}
          {recipe.instructions.length > 120 ? "..." : ""}
        </p>
      </div>
    </Link>
  );
}
