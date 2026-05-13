import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod";
import { generateEmbedding } from "./embedding.ts";
import type { Herb } from "./types.ts";

export const HerbSearchInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(10).optional(),
});

export type HerbSearchInput = z.infer<typeof HerbSearchInputSchema>;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export const HERB_SEARCH_TOOL = {
  name: "herb_search",
  description:
    "Search the Apothecary herb knowledge base by symptom, goal, or topic. " +
    "Returns the most semantically similar herbs from a curated catalog of 134 herbs. " +
    "Use this FIRST for any wellness query to ground recommendations in the catalog.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Free-text wellness query, e.g., 'restless sleep', 'iron deficiency', 'stress relief'.",
      },
      limit: {
        type: "integer",
        description: "Max herbs to return (default 5, max 10).",
      },
    },
    required: ["query"],
  },
};

export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 5,
};

export async function executeHerbSearch(
  query: string,
  limit?: number,
): Promise<Herb[]> {
  const clampedLimit = Math.min(Math.max(1, limit ?? 5), 10);
  const embedding = await generateEmbedding(query);
  const { data, error } = await supabase.rpc("match_herbs", {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: clampedLimit,
  });
  if (error) throw error;
  return (data ?? []) as Herb[];
}
