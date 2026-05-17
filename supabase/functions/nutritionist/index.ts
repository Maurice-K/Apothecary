import "@supabase/functions-js/edge-runtime.d.ts";

import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import {
  validateNutritionistRequest,
  ValidationError,
} from "../_shared/validation.ts";
import {
  MAX_ITERATIONS,
  MAX_OUTPUT_TOKENS,
  MODEL,
  openai,
} from "../_shared/openai.ts";
import {
  HERB_SEARCH_TOOL,
  HerbSearchInputSchema,
  WEB_SEARCH_TOOL,
} from "../_shared/tools.ts";
import { searchHerbs } from "../_shared/herb-search.ts";
import { createSseStream, sseHeaders, type SseStream } from "../_shared/sse.ts";
import {
  checkRateLimit,
  getClientIp,
  isDevMode,
} from "../_shared/rate-limit.ts";
import type { Herb } from "../_shared/types.ts";

const TOOLS = [HERB_SEARCH_TOOL, WEB_SEARCH_TOOL];

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface FunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

type AgentInputItem = ConversationMessage | FunctionCallOutput;

type ToolChoice = "auto" | "none" | { type: "function"; name: string };

const SYSTEM_PROMPT =
  `You are a warm, plainspoken nutritionist for Apothecary, an herbal wellness app. You know herbal medicine deeply but talk like a real practitioner — not a chatbot.

VOICE:
- Use contractions naturally: you'll, don't, that's, I've, here's.
- Vary sentence length and rhythm.
- Open by acknowledging what the user said. No templated greetings.
- NEVER say: "As an AI...", "I cannot...", "I'm here to help", "Feel free to ask...", "I hope this helps!", "Let me know if you have more questions!"
- No emojis.

WHEN TO USE TOOLS:
Tools are not always needed. Use judgment about what the user is asking.

- **New wellness query** (user asks about a symptom, goal, or topic for the first time — e.g., "what helps with sleep?", "I'm low on energy", "anything for bloating?"):
  1. Call herb_search to pull the top herbs from the Apothecary catalog.
  2. For EACH herb returned, call web_search separately with a focused, question-shaped query that includes the catalog description so the result is grounded in what we actually sell. Format: "How does <herb name> that is <description from herb_search verbatim> <verb> <user's ailment>?" Example: "How does Mugwort that is a traditional herb used for digestive support, menstrual regulation, and vivid dreaming. Known as a bitter digestive tonic and nervine. Has aromatic, slightly bitter properties help someone get better sleep?". One search per herb — pick the verb (aid, help, support, relieve, improve) that best fits.
  3. Write the per-herb response (see FORMAT).

- **Follow-up about herbs already discussed in this conversation** (e.g., "would these be safe with food?", "can I take this at night?", "what about with my Rx?"):
  - Do NOT call herb_search again — the cards are already shown.
  - Answer directly from the prior context. Optionally call web_search ONCE if you genuinely need to check a specific interaction, dose, or safety detail you don't already know.
  - Reply in prose without per-herb headers and without re-listing the herbs.

- **Casual reply, thanks, or clarifying chat** ("thanks", "got it", "what do you mean by X?"):
  - No tools. Brief, natural response.

- **Genuinely new wellness topic mid-conversation** (user pivots: "and what about for headaches?"):
  - Treat as a new wellness query — herb_search + per-herb web_search + cards.

FORMAT (only for new-wellness-query responses that called herb_search):
- Open with 1–2 sentences naming the user's issue and how the recommendations connect to it.
- Then, for EACH herb returned by herb_search (in the order returned), write a section:
  - An h3 header with just the herb name (e.g., \`### Ashwagandha\`).
  - 3–5 sentences synthesizing what the web search found about that herb for THIS user's issue: specific mechanism, evidence, key benefits. Don't repeat catalog blurb generically — pull the meat from the web result.
  - One short practical line: form, dose, timing, or how to take it.
  - One safety line: the single most important contraindication or interaction. Skip if genuinely none of note.
  - Cite web sources inline as markdown links \`[source](url)\` where the claim warrants it.
- End with one short humanlike closer (e.g., "Worth checking with your doctor before starting anything new, especially if you're on medication.").

LENGTH:
- New wellness queries: ~400–600 words total, substance per herb, no filler.
- Follow-ups and casual replies: as short as the question deserves. A safety follow-up might be 2–3 sentences.

ANCHORING:
- ONLY write sections for herbs that herb_search returned. Do not introduce other herbs from web results. If web search surfaces a noteworthy non-catalog herb, you may mention it in passing within an existing section, but never give it its own header.

SAFETY:
- For emergent symptoms (chest pain, suicidal ideation, breathing difficulty): redirect to emergency care immediately and do NOT recommend herbs.
- For Rx conditions: note herbs are supportive, not a substitute for prescribed medication.

FORMATTING:
- Markdown. h3 headers per herb. Inline links for web sources.`;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse(req, new Error("Method not allowed"), 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, new Error("Invalid JSON body"), 400);
  }

  let userMessages: ConversationMessage[];
  try {
    userMessages = validateNutritionistRequest(body).messages;
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse(req, err, 400);
    return errorResponse(req, err);
  }

  if (!isDevMode()) {
    const ip = getClientIp(req);
    if (!ip) {
      return errorResponse(req, new Error("Unable to identify client IP"), 400);
    }
    try {
      const limit = await checkRateLimit(ip);
      if (!limit.allowed) {
        return jsonResponse(
          req,
          { error: "rate_limit", retry_after_seconds: limit.retry_after_seconds },
          429,
          { "Retry-After": String(limit.retry_after_seconds) },
        );
      }
    } catch (err) {
      console.error("[nutritionist] rate-limit check failed:", err);
      return errorResponse(req, err);
    }
  }

  const sse = createSseStream();
  runAgentLoop(userMessages, sse).catch((err) => {
    console.error("[nutritionist] agent loop failed:", err);
    sse.send("error", {
      message: err instanceof Error ? err.message : "agent loop failed",
    });
    sse.close();
  });

  return new Response(sse.readable, { headers: sseHeaders(req) });
});

async function runAgentLoop(
  initialMessages: ConversationMessage[],
  sse: SseStream,
) {
  // After iter 0 we reference previous_response_id instead of re-sending the
  // chain — the server retains reasoning/function_call items we can't safely
  // round-trip (SDK adds fields like `parsed_arguments` the API rejects).
  let nextInput: AgentInputItem[] = [...initialMessages];
  let previousResponseId: string | undefined;

  // First message of a new conversation: force herb_search so the response is
  // anchored in the Apothecary catalog. On follow-up turns we let the model
  // decide — it has prior context and shouldn't re-search for questions like
  // "is this safe with food?" or casual replies.
  const isFirstUserTurn = initialMessages.every((m) => m.role !== "assistant");

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const toolChoice: ToolChoice = (iter === 0 && isFirstUserTurn)
      ? { type: "function", name: HERB_SEARCH_TOOL.name }
      : "auto";

    const finalResponse = await runOneTurn({
      input: nextInput,
      toolChoice,
      previousResponseId,
      iter,
      sse,
    });
    previousResponseId = finalResponse.id;

    const functionCalls = finalResponse.output.filter(
      // deno-lint-ignore no-explicit-any
      (item: any) => item.type === "function_call",
    );
    if (functionCalls.length === 0) {
      sse.send("done", {});
      sse.close();
      return;
    }

    nextInput = await Promise.all(functionCalls.map(handleToolCall(sse)));
  }

  // Iteration cap hit with tool calls still pending. Force a final synthesis
  // turn with tool_choice: "none" so the user gets a message instead of a
  // truncated stream.
  console.warn(
    `[nutritionist] iter cap (${MAX_ITERATIONS}) — forcing final synthesis`,
  );
  await runOneTurn({
    input: nextInput,
    toolChoice: "none",
    previousResponseId,
    iter: MAX_ITERATIONS,
    sse,
  });
  sse.send("done", {});
  sse.close();
}

async function runOneTurn(opts: {
  input: AgentInputItem[];
  toolChoice: ToolChoice;
  previousResponseId: string | undefined;
  iter: number;
  sse: SseStream;
}) {
  const stream = openai.responses.stream({
    model: MODEL,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    instructions: SYSTEM_PROMPT,
    tools: TOOLS,
    tool_choice: opts.toolChoice,
    reasoning: { effort: "low" },
    input: opts.input,
    ...(opts.previousResponseId
      ? { previous_response_id: opts.previousResponseId }
      : {}),
  });

  // deno-lint-ignore no-explicit-any
  for await (const event of stream as AsyncIterable<any>) {
    if (event.type === "response.output_text.delta" && event.delta) {
      opts.sse.send("text_delta", { delta: event.delta });
    } else if (
      event.type === "response.output_item.added" &&
      event.item?.type === "web_search_call"
    ) {
      // Hosted web_search runs inside the model — surface it as a tool_use so
      // the client's thinking indicator can show "researching..." instead of
      // sitting on "thinking..." through several searches.
      opts.sse.send("tool_use", { name: "web_search", input: {} });
    }
  }

  const finalResponse = await stream.finalResponse();
  if (finalResponse.status && finalResponse.status !== "completed") {
    console.error(
      `[nutritionist] iter=${opts.iter + 1} non-completed status=${finalResponse.status}`,
      finalResponse.incomplete_details ?? finalResponse.error,
    );
    throw new Error(
      `response ${finalResponse.status}: ${
        finalResponse.error?.message ??
          finalResponse.incomplete_details?.reason ?? "unknown"
      }`,
    );
  }

  if (isDevMode()) {
    // deno-lint-ignore no-explicit-any
    const items = finalResponse.output.map((i: any) => i.type).join(",");
    console.log(
      `[nutritionist] iter=${opts.iter + 1} status=${finalResponse.status} items=[${items}]`,
      finalResponse.usage,
    );
  }

  return finalResponse;
}

function handleToolCall(sse: SseStream) {
  // deno-lint-ignore no-explicit-any
  return async (call: any): Promise<FunctionCallOutput> => {
    const result = await executeToolCall(call, sse);
    return {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(result),
    };
  };
}

// deno-lint-ignore no-explicit-any
async function executeToolCall(call: any, sse: SseStream): Promise<unknown> {
  if (call.name !== HERB_SEARCH_TOOL.name) {
    return { error: `Unknown tool: ${call.name}` };
  }
  try {
    const args = HerbSearchInputSchema.parse(JSON.parse(call.arguments));
    sse.send("tool_use", { name: call.name, input: args });
    const herbs = await searchHerbs(args.query, args.limit);
    sse.send("herb_results", { herbs });
    return herbs.map(herbForModel);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "herb_search failed" };
  }
}

// Trim fields the model doesn't need to reason about: id and similarity are
// noise; how_to_use is brewing prose that dilutes signal (same reason it's
// excluded from embeddings).
function herbForModel(herb: Herb) {
  const { id: _id, how_to_use: _h, similarity: _s, ...rest } = herb;
  return rest;
}
