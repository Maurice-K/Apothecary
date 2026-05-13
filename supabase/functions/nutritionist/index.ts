import "@supabase/functions-js/edge-runtime.d.ts";

import { CORS_HEADERS, getAllowedOrigin, handleCors } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/response.ts";
import {
  validateNutritionistRequest,
  ValidationError,
} from "../_shared/validation.ts";
import {
  anthropic,
  MAX_ITERATIONS,
  MAX_TOKENS,
  MODEL,
} from "../_shared/anthropic.ts";
import {
  executeHerbSearch,
  HERB_SEARCH_TOOL,
  HerbSearchInputSchema,
  WEB_SEARCH_TOOL,
} from "../_shared/tools.ts";
import { createSseStream, sseHeaders, type SseStream } from "../_shared/sse.ts";
import {
  checkRateLimit,
  getClientIp,
  isDevMode,
} from "../_shared/rate-limit.ts";

const SYSTEM_PROMPT =
  `You are a warm, plainspoken nutritionist for Apothecary, an herbal wellness app. You know herbal medicine deeply but talk like a real practitioner — not a chatbot.

VOICE (non-negotiable):
- Use contractions naturally: you'll, don't, that's, I've, here's.
- Vary sentence length and rhythm. Mix prose and lists — don't bullet-point everything.
- Open by acknowledging what the user said. No templated greetings.
- NEVER say: "As an AI...", "I cannot...", "I'm here to help", "Feel free to ask...", "I hope this helps!", "Let me know if you have more questions!"
- Show curiosity when it fits: "how long has this been going on?", "anything else happening?"
- Sign off naturally — no templated closer on every message.

BREVITY (non-negotiable):
- Keep the whole response under ~250 words. A good answer is a short answer.
- Per herb: 2–3 sentences max. Name it, say what it does for this person's situation, one practical note (how to use it or the one most important caution). No mechanism deep-dives, no research summaries.
- Say the most important safety point ONCE. Don't repeat the same concern in different paragraphs.
- No emojis.

WORKFLOW:
1. If the user's intent is ambiguous, ask ONE clarifying question first.
2. Call herb_search to ground recommendations in the Apothecary catalog.
3. Optionally call web_search for the top 1–2 herbs to check dosage or a key contraindication. One search per herb, no more.
4. Synthesize briefly: short framing → 1–3 herbs → one-line safety note.

ANCHORING:
- Lead with herbs from herb_search. You MAY mention web-only herbs if clearly relevant — flag them as outside the catalog, never as primary picks.

SAFETY:
- End with one short humanlike disclaimer, e.g. "Worth checking with your doctor before starting anything new, especially if you're on medication."
- Surface the single most important contraindication per herb, not an exhaustive list.
- For emergent symptoms (chest pain, suicidal ideation, breathing difficulty): redirect to emergency care immediately and do NOT recommend herbs.
- For Rx conditions: note herbs are supportive, not a substitute for prescribed medication.

FORMATTING:
- Markdown. Brief headers per herb when discussing 2+ herbs. Cite sources inline as links.
- For a single herb or short answer, use prose — no headers needed.`;

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

  let userMessages;
  try {
    userMessages = validateNutritionistRequest(body).messages;
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse(req, err, 400);
    return errorResponse(req, err);
  }

  // Rate limit (skipped in dev mode)
  if (!isDevMode()) {
    const ip = getClientIp(req);
    if (!ip) {
      return errorResponse(
        req,
        new Error("Unable to identify client IP"),
        400,
      );
    }
    try {
      const limit = await checkRateLimit(ip);
      if (!limit.allowed) {
        return new Response(
          JSON.stringify({
            error: "rate_limit",
            retry_after_seconds: limit.retry_after_seconds,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(limit.retry_after_seconds),
              "Access-Control-Allow-Origin": getAllowedOrigin(req),
              ...CORS_HEADERS,
            },
          },
        );
      }
    } catch (err) {
      console.error("[nutritionist] rate-limit check failed:", err);
      return errorResponse(req, err);
    }
  }

  // SSE stream — agent loop runs in the background, writing events.
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
  initialMessages: { role: "user" | "assistant"; content: string }[],
  sse: SseStream,
) {
  // deno-lint-ignore no-explicit-any
  const messages: any[] = initialMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // deno-lint-ignore no-explicit-any
  const tools: any[] = [HERB_SEARCH_TOOL, WEB_SEARCH_TOOL];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        sse.send("text_delta", { delta: event.delta.text });
      }
    }

    const finalMessage = await stream.finalMessage();
    messages.push({
      role: "assistant",
      content: finalMessage.content,
    });

    console.log(
      `[nutritionist] iter=${iter + 1} stop=${finalMessage.stop_reason}`,
      finalMessage.usage,
    );

    if (finalMessage.stop_reason !== "tool_use") {
      sse.send("done", {});
      sse.close();
      return;
    }

    const clientToolUses = finalMessage.content.filter(
      // deno-lint-ignore no-explicit-any
      (c: any) => c.type === "tool_use",
    );

    if (clientToolUses.length === 0) {
      console.warn("[nutritionist] tool_use stop but no client tool calls");
      sse.send("done", {});
      sse.close();
      return;
    }

    const toolResults = await Promise.all(
      // deno-lint-ignore no-explicit-any
      clientToolUses.map(async (block: any) => {
        sse.send("tool_use", { name: block.name, input: block.input });

        if (block.name === "herb_search") {
          try {
            const input = HerbSearchInputSchema.parse(block.input);
            const herbs = await executeHerbSearch(input.query, input.limit);
            sse.send("herb_results", { herbs });
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(herbs),
            };
          } catch (err) {
            const message = err instanceof Error
              ? err.message
              : "herb_search failed";
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: message,
              is_error: true,
            };
          }
        }

        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: `Unknown tool: ${block.name}`,
          is_error: true,
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });
  }

  // Hit iteration cap — close out gracefully.
  console.warn(`[nutritionist] hit iteration cap of ${MAX_ITERATIONS}`);
  sse.send("done", {});
  sse.close();
}
