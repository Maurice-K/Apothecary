import { z } from "npm:zod";

export const HerbSearchInputSchema = z.object({
  query: z.string().min(1),
  // Default 3 keeps per-herb web-search cost reasonable while still giving the
  // model enough options. Cap at 10.
  limit: z.number().int().min(1).max(10).optional().default(3),
});

export type HerbSearchInput = z.infer<typeof HerbSearchInputSchema>;

export const HERB_SEARCH_TOOL = {
  type: "function" as const,
  name: "herb_search",
  description:
    "Search the Apothecary herb knowledge base by symptom, goal, or topic. " +
    "Returns the most semantically similar herbs from the curated catalog. " +
    "Use this FIRST for any wellness query to ground recommendations in the catalog.",
  // Not strict: we want `limit` to be optional from the model's perspective —
  // the Zod schema defaults it to 5 when omitted.
  strict: false,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Free-text wellness query, e.g., 'restless sleep', 'iron deficiency', 'stress relief'.",
      },
      limit: {
        type: "integer",
        description: "Max herbs to return (default 3, max 10).",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

// `search_context_size: "low"` returns less content per result — keeps
// per-herb writeups focused and lowers token spend.
export const WEB_SEARCH_TOOL = {
  type: "web_search" as const,
  search_context_size: "low" as const,
};
