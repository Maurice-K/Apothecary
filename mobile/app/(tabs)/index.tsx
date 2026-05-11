import { useState, memo } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Modal, ScrollView, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSearch } from "../../src/hooks/useSearch";
import type { HerbResult, RecipeResult } from "../../src/api/search";

type Tab = "herbs" | "recipes";

const TAG_COLORS = [
  { bg: "#E8EFE8", text: "#2D6A4F" },
  { bg: "#FCEEE4", text: "#C2703E" },
  { bg: "#EFEDF4", text: "#6B5B8D" },
  { bg: "#D8F3DC", text: "#1B4332" },
];

function getTagColor(index: number) {
  return TAG_COLORS[index % TAG_COLORS.length];
}

export default function SearchScreen() {
  const { results, loading, error, hasSearched, search } = useSearch();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("herbs");
  const [selectedHerb, setSelectedHerb] = useState<HerbResult | null>(null);

  function handleSearch() {
    if (query.trim()) search(query.trim());
  }

  const data = activeTab === "herbs" ? results.herbs : results.recipes;
  const herbCount = results.herbs.length;
  const recipeCount = results.recipes.length;

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>The Herbary</Text>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>&#x1F50D;</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search herbs, recipes..."
          placeholderTextColor="#A8A29E"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator color="#2D6A4F" size="small" style={{ marginRight: 4 }} />
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {hasSearched ? (
        <>
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === "herbs" && styles.tabActive]}
              onPress={() => setActiveTab("herbs")}
            >
              <Text style={[styles.tabText, activeTab === "herbs" && styles.tabTextActive]}>
                Herbs ({herbCount})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "recipes" && styles.tabActive]}
              onPress={() => setActiveTab("recipes")}
            >
              <Text style={[styles.tabText, activeTab === "recipes" && styles.tabTextActive]}>
                Recipes ({recipeCount})
              </Text>
            </Pressable>
          </View>

          {data.length > 0 ? (
            <FlashList
              data={data}
              renderItem={({ item }) =>
                activeTab === "herbs" ? (
                  <HerbCard herb={item as HerbResult} onPress={setSelectedHerb} />
                ) : (
                  <RecipeCard recipe={item as RecipeResult} />
                )
              }
              estimatedItemSize={140}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyText}>
                No {activeTab} found for "{query}"
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Discover</Text>
          <Text style={styles.emptyText}>Search for herbs and plant-based recipes</Text>
        </View>
      )}

      <Modal
        visible={selectedHerb !== null}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setSelectedHerb(null)}
      >
        {selectedHerb ? (
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedHerb.name}</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setSelectedHerb(null)}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={styles.tagRow}>
                {selectedHerb.category.map((cat, i) => {
                  const color = getTagColor(i);
                  return (
                    <View key={cat} style={[styles.tag, { backgroundColor: color.bg }]}>
                      <Text style={[styles.tagText, { color: color.text }]}>{cat.toUpperCase()}</Text>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.modalSectionTitle}>Description</Text>
              <Text style={styles.modalText}>{selectedHerb.description}</Text>

              <Text style={styles.modalSectionTitle}>How to Use</Text>
              <Text style={styles.modalText}>{selectedHerb.how_to_use}</Text>
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const HerbCard = memo(function HerbCard({
  herb,
  onPress,
}: {
  herb: HerbResult;
  onPress: (herb: HerbResult) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(herb)}
    >
      <Text style={styles.cardTitle}>{herb.name}</Text>
      <Text style={styles.cardDescription} numberOfLines={3}>
        {herb.description}
      </Text>
      <View style={styles.tagRow}>
        {herb.category.map((cat, i) => {
          const color = getTagColor(i);
          return (
            <View key={cat} style={[styles.tag, { backgroundColor: color.bg }]}>
              <Text style={[styles.tagText, { color: color.text }]}>{cat.toUpperCase()}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
});

const RecipeCard = memo(function RecipeCard({ recipe }: { recipe: RecipeResult }) {
  const router = useRouter();

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
    >
      <Text style={styles.cardTitle}>{recipe.name}</Text>
      <Text style={styles.cardMeta}>
        {recipe.ingredients.length} ingredients
        {recipe.prep_time ? ` · ${recipe.prep_time} min` : ""}
      </Text>
      <Text style={styles.cardDescription} numberOfLines={2}>
        {recipe.instructions}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F6",
    paddingHorizontal: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1B4332",
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 16,
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F1EC",
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 20,
  },
  searchIcon: {
    fontSize: 16,
    opacity: 0.4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1C1917",
    height: 48,
  },

  // Error
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
  },

  // Tabs
  tabs: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E7E5E4",
  },
  tab: {
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#2D6A4F",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#A8A29E",
  },
  tabTextActive: {
    color: "#2D6A4F",
  },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B4332",
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    fontWeight: "500",
    color: "#A8A29E",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 15,
    color: "#78716C",
    lineHeight: 22,
  },

  // Tags
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#44403C",
  },
  emptyText: {
    fontSize: 15,
    color: "#A8A29E",
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E7E5E4",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1B4332",
    flex: 1,
  },
  modalCloseButton: {
    backgroundColor: "#F3F1EC",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2D6A4F",
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A8A29E",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: "#1C1917",
    lineHeight: 24,
  },
});
