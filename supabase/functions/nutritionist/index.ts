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
import { decideStage, type Stage } from "../_shared/jev.ts";
import { createSseStream, sseHeaders, type SseStream } from "../_shared/sse.ts";
import {
  checkRateLimit,
  getClientIp,
  isDevMode,
} from "../_shared/rate-limit.ts";
import type { Herb } from "../_shared/types.ts";

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

type AgentTool = typeof HERB_SEARCH_TOOL | typeof WEB_SEARCH_TOOL;

type ToolChoice = "auto" | "none" | { type: "function"; name: string };

const BASE_PROMPT =
  `You are a warm, plainspoken nutritionist for Apothecary, an herbal wellness app. You know herbal medicine deeply but talk like a real practitioner — not a chatbot.

VOICE:
- Use contractions naturally: you'll, don't, that's, I've, here's.
- Vary sentence length and rhythm.
- Open by acknowledging what the user said. No templated greetings.
- NEVER say: "As an AI...", "I cannot...", "I'm here to help", "Feel free to ask...", "I hope this helps!", "Let me know if you have more questions!"
- No emojis.

SAFETY:
- For emergent symptoms (chest pain, suicidal ideation, breathing difficulty): redirect to emergency care immediately and do NOT recommend herbs.
- For Rx conditions: note herbs are supportive, not a substitute for prescribed medication.

FORMATTING:
- Markdown. Inline links for web sources.`;

const DIAGNOSTIC_PROMPT = `STAGE — DIAGNOSIS (no tools):
You don't understand the user's concern well enough to recommend anything yet. Take care of the person first; herbs come later.
- Acknowledge what they're dealing with in a sentence or two. Be human about it.
- Ask 1–3 focused questions whose answers would change what you'd recommend. Pick what's still unclear: how long it's been going on, when it shows up or what makes it better or worse, how much it's affecting them, and any medications, conditions, pregnancy or breastfeeding. Never re-ask something they've already told you.
- If it genuinely helps right now, offer one or two simple non-herbal comfort tips (rest, hydration, a warm compress).
- Do NOT name, suggest or hint at any herbs, teas, supplements or products yet.
- Keep it under ~120 words. Use a short list only when you ask more than one question.`;

const TREATMENT_PROMPT = `STAGE — TREATMENT:
You understand the user's concern well enough to recommend herbs.
1. Call herb_search to pull the top herbs from the Apothecary catalog. Build the query from everything the user has told you, not just their first message — the concern plus the specifics that matter (e.g., "waking at 3am with racing thoughts" rather than "sleep").
2. For EACH herb returned, call web_search separately with a focused, question-shaped query that includes the catalog description so the result is grounded in what we actually sell. Format: "How does <herb name> that is <description from herb_search verbatim> <verb> <user's ailment>?" Example: "How does Mugwort that is a traditional herb used for digestive support, menstrual regulation, and vivid dreaming. Known as a bitter digestive tonic and nervine. Has aromatic, slightly bitter properties help someone get better sleep?". One search per herb — pick the verb (aid, help, support, relieve, improve) that best fits.
3. Write the per-herb response (see FORMAT).

FORMAT:
- Open with 1–2 sentences naming the user's issue, in light of what they told you, and how the recommendations connect to it.
- Then, for EACH herb returned by herb_search (in the order returned), write a section:
  - An h3 header with just the herb name (e.g., \`### Ashwagandha\`).
  - 3–5 sentences synthesizing what the web search found about that herb for THIS user's issue: specific mechanism, evidence, key benefits. Don't repeat catalog blurb generically — pull the meat from the web result.
  - One short practical line: form, dose, timing, or how to take it.
  - One safety line: the single most important contraindication or interaction, weighed against anything the user told you (medications, conditions, pregnancy). Skip if genuinely none of note.
  - Cite web sources inline as markdown links \`[source](url)\` where the claim warrants it.
- End with one short humanlike closer (e.g., "Worth checking with your doctor before starting anything new, especially if you're on medication.").

LENGTH: ~400–600 words total, substance per herb, no filler.

ANCHORING:
- ONLY write sections for herbs that herb_search returned. Do not introduce other herbs from web results. If web search surfaces a noteworthy non-catalog herb, you may mention it in passing within an existing section, but never give it its own header.`;

const AFTERCARE_PROMPT = `STAGE — FOLLOW-UP:
The user is asking about herbs you already recommended in this conversation (e.g., "would these be safe with food?", "can I take this at night?", "what about with my Rx?"). Their cards are already on screen.
- Answer directly from the prior context. Call web_search at most ONCE, and only if you genuinely need to check a specific interaction, dose, or safety detail you don't already know.
- Reply in prose without per-herb headers and without re-listing the herbs.
- As short as the question deserves. A safety follow-up might be 2–3 sentences.`;

const CHAT_PROMPT = `STAGE — CHAT (no tools):
Thanks, small talk, or a general question. Reply briefly and naturally. If the user hasn't shared what's going on with them yet and it fits, invite them to. Don't recommend herbs for a personal concern here; that comes after you've asked about it.`;

const EMERGENCY_PROMPT = `STAGE — URGENT (no tools):
The user may be describing a medical emergency. Tell them clearly and kindly to get emergency care now: call 911 or their local emergency number, or for suicidal thoughts call or text 988 (US) or their local crisis line. Keep it short and calm. Do NOT recommend herbs or home remedies.`;

// Jev was unreachable, so the model routes itself with every stage's rules.
const FALLBACK_PROMPT = `Work out which stage the conversation is in, then follow only that stage's rules. When the user raises a concern you don't understand well yet, diagnose before recommending.

${DIAGNOSTIC_PROMPT.replace(" (no tools)", "")}

${TREATMENT_PROMPT}

${AFTERCARE_PROMPT}

${CHAT_PROMPT.replace(" (no tools)", "")}`;

interface StagePlan {
  prompt: string;
  // Omitted → the model gets no tools, so it can only reply in text.
  tools?: AgentTool[];
  firstToolChoice?: ToolChoice;
}

// Jev picks the stage; the stage decides what the model can reach.
// herb_search (the vector DB, and so the herb cards) is only offered in
// treatment, and in fallback after the first turn — the prompt can't talk the
// model past that.
const STAGE_PLANS: Record<Stage, StagePlan> = {
  diagnostic: { prompt: DIAGNOSTIC_PROMPT },
  treatment: {
    prompt: TREATMENT_PROMPT,
    tools: [HERB_SEARCH_TOOL, WEB_SEARCH_TOOL],
    firstToolChoice: { type: "function", name: HERB_SEARCH_TOOL.name },
  },
  aftercare: { prompt: AFTERCARE_PROMPT, tools: [WEB_SEARCH_TOOL] },
  chat: { prompt: CHAT_PROMPT },
  emergency: { prompt: EMERGENCY_PROMPT },
  fallback: {
    prompt: FALLBACK_PROMPT,
    tools: [HERB_SEARCH_TOOL, WEB_SEARCH_TOOL],
  },
};

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
    if (sse.signal.aborted) {
      console.log("[nutritionist] client disconnected — agent loop stopped");
      return;
    }
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

  const { stage, answers } = await decideStage(initialMessages, sse.signal);
  sse.send("stage", { stage });
  if (isDevMode()) {
    console.log(`[nutritionist] stage=${stage}`, JSON.stringify(answers ?? null));
  }
  // Without Jev we can't tell whether a first message says enough, so always
  // ask before recommending — no cards on a cold open.
  const isFirstUserTurn = initialMessages.every((m) => m.role !== "assistant");
  const plan = stage === "fallback" && isFirstUserTurn
    ? STAGE_PLANS.diagnostic
    : STAGE_PLANS[stage];
  const instructions = `${BASE_PROMPT}\n\n${plan.prompt}`;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const toolChoice: ToolChoice = (iter === 0 && plan.firstToolChoice) || "auto";

    const finalResponse = await runOneTurn({
      input: nextInput,
      instructions,
      tools: plan.tools,
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
    instructions,
    tools: plan.tools,
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
  instructions: string;
  tools: AgentTool[] | undefined;
  toolChoice: ToolChoice;
  previousResponseId: string | undefined;
  iter: number;
  sse: SseStream;
}) {
  // Passing the SSE signal cancels the OpenAI request (and the rest of the
  // loop, via the thrown abort error) when the client goes away.
  const stream = openai.responses.stream({
    model: MODEL,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    instructions: opts.instructions,
    // Tool-less stages send neither field, so the turn can only be text.
    ...(opts.tools ? { tools: opts.tools, tool_choice: opts.toolChoice } : {}),
    reasoning: { effort: "low" },
    input: opts.input,
    ...(opts.previousResponseId
      ? { previous_response_id: opts.previousResponseId }
      : {}),
  }, { signal: opts.sse.signal });

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

// Trim fields the model doesn't need to reason about: id and the similarity
// and relevance scores are noise; how_to_use is brewing prose that dilutes
// signal (same reason it's excluded from embeddings).
function herbForModel(herb: Herb) {
  const { id: _id, how_to_use: _h, similarity: _s, relevance: _r, ...rest } = herb;
  return rest;
}
