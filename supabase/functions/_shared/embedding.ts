import OpenAI from "npm:openai@4";

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

const MAX_INPUT_LENGTH = 500;

// Prepending a stem pulls bare keyword queries ("energy", "sleep") closer to the
// herb document embeddings, which are themselves *about* herbs.
const QUERY_STEM = "Herb for ";

export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.slice(0, MAX_INPUT_LENGTH);
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: QUERY_STEM + trimmed,
  });
  return data[0].embedding;
}
