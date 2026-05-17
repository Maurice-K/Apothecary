import { openai } from "./openai.ts";

const MAX_INPUT_LENGTH = 500;

export async function generateEmbedding(text: string): Promise<number[]> {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, MAX_INPUT_LENGTH),
  });
  return data[0].embedding;
}
