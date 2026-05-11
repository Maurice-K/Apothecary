import { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { fetchRecipeById, getPhotoUrl, type Recipe } from "../../src/api/recipes";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecipeById(id)
      .then(setRecipe)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Recipe not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {recipe.photo_path ? (
        <Image
          source={{ uri: getPhotoUrl(recipe.photo_path) }}
          style={styles.photo}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : null}

      <Text style={styles.title}>{recipe.name}</Text>

      {recipe.prep_time ? (
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>{recipe.prep_time} min</Text>
          </View>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>{recipe.ingredients.length} ingredients</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>INGREDIENTS</Text>
      {recipe.ingredients.map((ing, i) => (
        <View key={i} style={styles.ingredientRow}>
          <View style={styles.ingredientDot} />
          <Text style={styles.ingredientText}>{ing}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>INSTRUCTIONS</Text>
      <Text style={styles.instructions}>{recipe.instructions}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  content: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF9F6",
  },
  photo: {
    width: "100%",
    height: 280,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1B4332",
    letterSpacing: -0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  metaBadge: {
    backgroundColor: "#F3F1EC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  metaBadgeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#44403C",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A8A29E",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2D6A4F",
  },
  ingredientText: {
    fontSize: 16,
    color: "#1C1917",
    lineHeight: 24,
  },
  instructions: {
    fontSize: 16,
    color: "#1C1917",
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#B91C1C",
  },
});
