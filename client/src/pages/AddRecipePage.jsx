import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { createRecipe, uploadRecipePhoto } from "../api/recipes";
import { supabase } from "../api/supabaseClient";
import "./AddRecipePage.css";

export default function AddRecipePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState([""]);
  const [instructions, setInstructions] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!user) {
    navigate("/login");
    return null;
  }

  function addIngredient() {
    setIngredients([...ingredients, ""]);
  }

  function updateIngredient(index, value) {
    const updated = [...ingredients];
    updated[index] = value;
    setIngredients(updated);
  }

  function removeIngredient(index) {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validIngredients = ingredients.filter((i) => i.trim());
    if (!name.trim() || validIngredients.length === 0 || instructions.trim().length < 10) {
      setError("Please fill in name, at least one ingredient, and instructions (10+ characters).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const recipe = await createRecipe({
        name: name.trim(),
        ingredients: validIngredients,
        instructions: instructions.trim(),
        prep_time: prepTime ? parseInt(prepTime, 10) : null,
      });

      if (photo) {
        const photoPath = await uploadRecipePhoto(user.id, photo);
        await supabase
          .from("recipes")
          .update({ photo_path: photoPath })
          .eq("id", recipe.id);
      }

      navigate("/my-recipes");
    } catch (err) {
      setError(err.message || "Failed to create recipe");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="add-recipe">
      <h2 className="add-recipe-title">Add Recipe</h2>
      <form className="add-recipe-form" onSubmit={handleSubmit}>
        {error && <p className="auth-error">{error}</p>}

        <label className="add-recipe-label">
          Name
          <input
            className="add-recipe-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chamomile Sleep Tea"
          />
        </label>

        <div className="add-recipe-label">
          Ingredients
          {ingredients.map((ing, i) => (
            <div key={i} className="ingredient-row">
              <input
                className="add-recipe-input"
                value={ing}
                onChange={(e) => updateIngredient(i, e.target.value)}
                placeholder={`Ingredient ${i + 1}`}
              />
              {ingredients.length > 1 && (
                <button type="button" className="ingredient-remove" onClick={() => removeIngredient(i)}>
                  X
                </button>
              )}
            </div>
          ))}
          <button type="button" className="ingredient-add" onClick={addIngredient}>
            + Add Ingredient
          </button>
        </div>

        <label className="add-recipe-label">
          Instructions
          <textarea
            className="add-recipe-input add-recipe-textarea"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="How to prepare..."
            rows={4}
          />
        </label>

        <label className="add-recipe-label">
          Prep Time (minutes)
          <input
            className="add-recipe-input"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            placeholder="e.g. 15"
            type="number"
          />
        </label>

        <label className="add-recipe-label">
          Photo (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="add-recipe-file"
            onChange={(e) => setPhoto(e.target.files[0] || null)}
          />
        </label>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Recipe"}
        </button>
      </form>
    </div>
  );
}
