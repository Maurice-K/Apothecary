import RecipeCard from "./RecipeCard";
import "./RecipeCardList.css";

export default function RecipeCardList({ recipes }) {
  return (
    <div className="recipe-card-list">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
