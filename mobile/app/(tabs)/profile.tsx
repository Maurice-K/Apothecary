import { useState, useEffect, useCallback, memo } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { fetchMyRecipes, deleteRecipe, type Recipe } from "../../src/api/recipes";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecipes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchMyRecipes();
      setRecipes(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const handleDelete = useCallback(async (id: number, name: string) => {
    Alert.alert("Delete Recipe", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRecipe(id);
            setRecipes((prev) => prev.filter((r) => r.id !== id));
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete");
          }
        },
      },
    ]);
  }, []);

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredEmoji}>&#x1F33F;</Text>
        <Text style={styles.centeredTitle}>Your kitchen</Text>
        <Text style={styles.centeredSubtitle}>Log in to manage your recipes and connect with the community.</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.buttonText}>Log In</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.buttonOutline, pressed && styles.buttonPressed]}
            onPress={() => router.push("/signup")}
          >
            <Text style={styles.buttonOutlineText}>Sign Up</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>My Recipes</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
          onPress={signOut}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>

      {recipes.length > 0 ? (
        <FlashList
          data={recipes}
          renderItem={({ item }) => (
            <MyRecipeCard
              recipe={item}
              onPress={() => router.push(`/recipe/${item.id}`)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
          estimatedItemSize={80}
          keyExtractor={(item) => String(item.id)}
          onRefresh={loadRecipes}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {loading ? "Loading..." : "No recipes yet. Tap Add Recipe to create your first one."}
          </Text>
        </View>
      )}
    </View>
  );
}

const MyRecipeCard = memo(function MyRecipeCard({
  recipe,
  onPress,
  onDelete,
}: {
  recipe: Recipe;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
      onPress={onPress}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{recipe.name}</Text>
        <Text style={styles.cardMeta}>
          {recipe.ingredients.length} ingredients
          {recipe.prep_time ? ` · ${recipe.prep_time} min` : ""}
        </Text>
      </View>
      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F6",
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF9F6",
    padding: 20,
    gap: 6,
  },
  centeredEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  centeredTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1B4332",
  },
  centeredSubtitle: {
    fontSize: 15,
    color: "#78716C",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
    maxWidth: 280,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1B4332",
    letterSpacing: -0.5,
  },
  email: {
    fontSize: 13,
    color: "#A8A29E",
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: "#F3F1EC",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: "#44403C",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#A8A29E",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    backgroundColor: "#2D6A4F",
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonOutline: {
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2D6A4F",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonOutlineText: {
    color: "#2D6A4F",
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B4332",
  },
  cardMeta: {
    fontSize: 13,
    color: "#A8A29E",
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
});
