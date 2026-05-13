import Anthropic from "npm:@anthropic-ai/sdk";

const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
if (!apiKey) {
  console.warn("[anthropic] ANTHROPIC_API_KEY is not set");
}

export const anthropic = new Anthropic({ apiKey });

export const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
export const MAX_ITERATIONS = 6;
export const MAX_TOKENS = 2048;
