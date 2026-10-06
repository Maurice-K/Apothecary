/** Herb record from the herbs table */
export interface Herb {
  id: number;
  name: string;
  description: string;
  how_to_use: string;
  category: string[];
  tags: string[] | null;
  energetics: string[] | null;
  botanical_name: string | null;
  plant_part: string | null;
  origin: string | null;
  form: string | null;
  similarity: number;
  /** Cohere rerank score (0–1); absent when reranking was skipped */
  relevance?: number;
}

/** Request body for the search endpoint */
export interface SearchRequest {
  query: string;
  limit?: number;
}

/** Standard error response */
export interface ErrorResponse {
  error: string;
}

/** Single message in a nutritionist chat conversation (client view). */
export interface NutritionistMessage {
  role: "user" | "assistant";
  content: string;
}

/** Request body for the nutritionist Edge Function. */
export interface NutritionistRequest {
  messages: NutritionistMessage[];
}
