import OpenAI from "npm:openai@6";

const apiKey = Deno.env.get("OPENAI_API_KEY");
if (!apiKey) {
  console.warn("[openai] OPENAI_API_KEY is not set");
}

export const openai = new OpenAI({ apiKey });

export const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";
export const MAX_ITERATIONS = 6;
// gpt-5-mini is a reasoning model — reasoning + tool calls + the final
// message all share this budget, so keep it generous.
export const MAX_OUTPUT_TOKENS = 8192;
