import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { supabase } from "../../src/api/supabaseClient";
import { createRecipe, uploadRecipePhoto } from "../../src/api/recipes";

export default function AddRecipeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [instructions, setInstructions] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredEmoji}>&#x1F331;</Text>
        <Text style={styles.centeredTitle}>Share a recipe</Text>
        <Text style={styles.centeredSubtitle}>Log in to share your plant-based creations with the community.</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.buttonText}>Log In</Text>
        </Pressable>
      </View>
    );
  }

  function addIngredient() {
    setIngredients([...ingredients, ""]);
  }

  function updateIngredient(index: number, value: string) {
    const updated = [...ingredients];
    updated[index] = value;
    setIngredients(updated);
  }

  function removeIngredient(index: number) {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto({
        uri: result.assets[0].uri,
        base64: result.assets[0].base64,
      });
    }
  }

  async function handleSubmit() {
    const validIngredients = ingredients.filter((i) => i.trim());
    if (!name.trim() || validIngredients.length === 0 || instructions.trim().length < 10) {
      Alert.alert("Missing fields", "Please fill in name, at least one ingredient, and instructions (10+ characters).");
      return;
    }

    setLoading(true);
    try {
      const recipe = await createRecipe({
        name: name.trim(),
        ingredients: validIngredients,
        instructions: instructions.trim(),
        prep_time: prepTime ? parseInt(prepTime, 10) : null,
      });

      if (photo) {
        const photoPath = await uploadRecipePhoto(user.id, photo.base64);
        await supabase
          .from("recipes")
          .update({ photo_path: photoPath })
          .eq("id", recipe.id);
      }

      Alert.alert("Success", "Recipe created!", [
        { text: "OK", onPress: () => {
          setName("");
          setIngredients([""]);
          setInstructions("");
          setPrepTime("");
          setPhoto(null);
        }},
      ]);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create recipe");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>New Recipe</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Golden Turmeric Latte" placeholderTextColor="#A8A29E" />

      <Text style={styles.label}>Ingredients</Text>
      {ingredients.map((ing, i) => (
        <View key={i} style={styles.ingredientRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={ing}
            onChangeText={(v) => updateIngredient(i, v)}
            placeholder={`Ingredient ${i + 1}`}
            placeholderTextColor="#A8A29E"
          />
          {ingredients.length > 1 ? (
            <Pressable style={styles.removeButton} onPress={() => removeIngredient(i)}>
              <Text style={styles.removeButtonText}>&#x2715;</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addIngredient}>
        <Text style={styles.addButtonText}>+ Add ingredient</Text>
      </Pressable>

      <Text style={styles.label}>Instructions</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={instructions}
        onChangeText={setInstructions}
        placeholder="How to prepare..."
        placeholderTextColor="#A8A29E"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Prep Time (minutes)</Text>
      <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} placeholder="e.g. 15" placeholderTextColor="#A8A29E" keyboardType="numeric" />

      <Text style={styles.label}>Photo (optional)</Text>
      <Pressable style={styles.photoPicker} onPress={pickPhoto}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderIcon}>&#x1F4F7;</Text>
            <Text style={styles.photoPlaceholderText}>Tap to add a photo</Text>
          </View>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitButtonText}>Create Recipe</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
    maxWidth: 260,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1B4332",
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#44403C",
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F3F1EC",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1C1917",
    height: 48,
  },
  textArea: {
    minHeight: 120,
    height: "auto",
    textAlignVertical: "top",
    paddingTop: 14,
  },
  ingredientRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  removeButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 48,
    height: 48,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
  },
  removeButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 16,
  },
  addButton: {
    paddingVertical: 8,
  },
  addButtonText: {
    color: "#2D6A4F",
    fontWeight: "600",
    fontSize: 14,
  },
  photoPicker: {
    backgroundColor: "#F3F1EC",
    borderRadius: 16,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  photoPlaceholder: {
    alignItems: "center",
    gap: 8,
  },
  photoPlaceholderIcon: {
    fontSize: 32,
    opacity: 0.4,
  },
  photoPlaceholderText: {
    color: "#A8A29E",
    fontSize: 14,
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  button: {
    backgroundColor: "#2D6A4F",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
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
  submitButton: {
    backgroundColor: "#2D6A4F",
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
});
