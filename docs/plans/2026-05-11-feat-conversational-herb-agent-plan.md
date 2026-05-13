---
title: "feat: Conversational Herb Agent"
type: feat
date: 2026-05-11
---

# Conversational Herb Agent

## Overview

Build a conversational AI nutritionist that answers wellness questions using the existing 134-herb knowledge base as the primary signal, then enriches each recommendation with live web search. The nutritionist runs a multi-turn agentic loop with the `@anthropic-ai/sdk` tool-use API: it can ask clarifying questions, search the herb DB, run targeted web searches, and synthesize grounded responses. The React client renders the nutritionist's reply as streaming chat text *alongside* the existing herb cards for any herbs the nutritionist selected from the KB.

## Problem Statement / Motivation

The current Apothecary experience is one-shot: type a query, get cards back. Users can't ask follow-ups, get reasoning, or learn *why* a herb is being recommended. The single-search UX also can't handle vague or layered questions ("I've been stressed and can't sleep — what do you recommend?"). A conversational nutritionist fills that gap while keeping the curated 134 herbs as the trusted anchor, and pulls in current external evidence (mechanism, dosage hints, contraindications) via web search rather than relying on the model's training data alone.

## Proposed Solution

### Architecture

```
┌─────────────────────────────────────────────┐
│  React client                                │
│  ┌─────────────┐     ┌──────────────────┐    │
│  │  Chat panel │     │  Herb card row   │    │
│  │  (streaming)│ ←→  │  (KB hits, inline│    │
│  │             │     │   per message)   │    │
│  └─────────────┘     └──────────────────┘    │
└──────────────────────┬──────────────────────┘
                       │  SSE  (fetch + reader)
┌──────────────────────┴──────────────────────┐
│  supabase/functions/nutritionist/index.ts    │
│  Agentic tool-use loop (@anthropic-ai/sdk)   │
│  ┌──────────────────────────────────────┐    │
│  │ Tools:                                │   │
│  │  • herb_search(query, limit?)         │   │
│  │  • web_search  (Anthropic-hosted)     │   │
│  └──────────────────────────────────────┘    │
└──────────────┬─────────────────────┬─────────┘
               │                     │
   ┌───────────┴─────────────┐   ┌───┴────────────────┐
   │ Supabase RPC            │   │ Anthropic web_search│
   │ match_herbs (existing)  │   │ (hosted tool)      │
   └─────────────────────────┘   └────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SDK | `@anthropic-ai/sdk` (tool use), not Claude Agent SDK | Two tools, no file/subprocess needs; fits Deno Edge Function; minimal surface |
| Runtime | New Edge Function `supabase/functions/nutritionist/` | Reuses existing `_shared/` modules (CORS, embedding, types); one backend |
| Model | `claude-sonnet-4-6` default; `claude-opus-4-7` configurable | Sonnet's quality is plenty for v1 wellness conversations at ~1/5 the cost; Opus available for higher-fidelity runs via env var |
| Persona | Warm, plainspoken nutritionist — a real practitioner, not a chatbot | Distinct character; reads as a human, builds trust |
| Voice | Conversational and humanlike: contractions, varied rhythm, no AI tells | Avoids robotic patterns ("As an AI...", "Hope this helps!", over-bulleted responses) |
| Tool 1: herb_search | Wraps `match_herbs` RPC | Reuse, single source of truth for KB results |
| Tool 2: web_search | Anthropic's hosted `web_search` tool | No extra provider key, returns citations natively, server-side |
| Anchoring strictness | **Open** | Nutritionist leads with KB herbs but may surface web-only herbs when clearly relevant (flagged as outside the catalog) |
| Conversation model | Multi-turn agentic loop; clarifying questions allowed | Feels like talking to a real practitioner |
| Tool-call parallelism | Agent may request multiple `web_search` calls in one turn | Reduces latency when expanding on 2–3 KB hits |
| Streaming | SSE from Edge Function → client | Progressive text appearance, matches modern chat UX |
| History | Client-side only; full message array sent each turn | Stateless backend; defer persistence |
| Card rendering | Client filters cards by `id` returned from `herb_search` tool call | Cards only render for *real* KB herbs, never hallucinated |
| Safety footer | Always appended; emergent symptoms → redirect to medical care, no herb recommendation | Wellness advice liability |
| Iteration cap | 6 agent loop iterations | Prevents runaway cost / timeout |
| New chat page | New route `/nutritionist`, keep existing `/` search | Non-destructive; existing search UX remains |
| Rate limiting | Per-IP, 5 req/min + 30 req/day, Postgres-backed atomic RPC | Cost protection without external infra; works pre-auth |

---

## Technical Approach

### Edge Function: `supabase/functions/nutritionist/index.ts`

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "How do I get better sleep?" }
  ]
}
```

**Response:** SSE stream
```
event: text_delta
data: { "delta": "Based on what you've described..." }

event: herb_results
data: { "herbs": [{ "id": 42, "name": "Valerian", "description": "...", "how_to_use": "...", "category": [...], "similarity": 0.71 }] }

event: tool_use
data: { "name": "web_search", "query": "valerian root for sleep evidence" }

event: done
data: {}

event: error
data: { "message": "..." }
```

**Agentic loop (pseudocode):**
```ts
let convo = body.messages;
const tools = [HERB_SEARCH_TOOL, WEB_SEARCH_TOOL];

for (let i = 0; i < MAX_ITERATIONS; i++) {
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools,
    messages: convo,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      sse.send("text_delta", { delta: event.delta.text });
    }
  }
  const final = await stream.finalMessage();
  convo.push({ role: "assistant", content: final.content });

  if (final.stop_reason !== "tool_use") {
    sse.send("done", {});
    break;
  }

  const toolUses = final.content.filter((c) => c.type === "tool_use");
  const results = await Promise.all(toolUses.map(executeTool));
  // executeTool emits herb_results / tool_use SSE events as side effects
  convo.push({ role: "user", content: results });
}
```

> Note: `role: "assistant"` in the code above is the Anthropic API protocol value (one of `"user"` | `"assistant"`) and must stay literal. It's not the persona name.

### Tool definitions: `supabase/functions/_shared/tools.ts`

```ts
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
        description: "Free-text wellness query, e.g., 'restless sleep', 'iron deficiency', 'stress'",
      },
      limit: {
        type: "integer",
        description: "Max herbs to return (default 5)",
      },
    },
    required: ["query"],
  },
};

export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
};
```

### Herb search executor

Reuses `_shared/embedding.ts` for query embedding, then calls the existing `match_herbs` RPC. Returns the same shape as the `/search` Edge Function. Emits an `herb_results` SSE event so the client can render cards inline.

### System prompt strategy

- **Identity**: a warm, plainspoken nutritionist who knows herbal medicine deeply. Clear, kind, never alarmist. Talks like a real practitioner — not a chatbot.
- **Voice (humanlike)** — this is non-negotiable:
  - Use contractions naturally: *you'll*, *don't*, *that's*, *I've*, *here's*.
  - Vary sentence length and rhythm. Don't bullet-point every response — prose builds connection, lists aid clarity. Mix them.
  - Open by acknowledging what the user actually said (in their words), not a templated greeting.
  - **Never** say AI-tell phrases: *"As an AI..."*, *"I cannot..."*, *"I'm here to help"*, *"Feel free to ask..."*, *"I hope this helps!"*, *"Let me know if you have more questions!"*.
  - Don't over-format short answers with headers. A two-sentence answer is a two-sentence answer.
  - Show curiosity. Ask the things a real nutritionist would notice: *"how long has this been going on?"*, *"anything else happening at the same time?"*, *"what's worked for you before?"*.
  - Sign off naturally — don't tag every response with a templated closer.
- **Workflow**:
  1. If the user's intent is ambiguous, ask ONE clarifying question first (in a humanlike way).
  2. Call `herb_search` with the user's intent.
  3. For top 1–3 returned herbs, optionally call `web_search` (`"<herb> for <user's concern>"`) to expand on mechanism, dosage hints, evidence, and contraindications. Parallel calls allowed.
  4. Synthesize: brief framing → 1–3 herbs with KB description + web-enriched context → safety note.
- **Open anchoring**: Lead with herbs from `herb_search`. You MAY mention other herbs the web surfaces if clearly relevant — but flag them as "not in the Apothecary catalog" and never as primary recommendations.
- **Safety**:
  - Always end with a brief, humanlike disclaimer — not a stiff one. Something like: *"Quick note — I'm not a substitute for a real doctor; if any of this is severe or sticking around, please get it looked at."*
  - Surface contraindications when known (pregnancy, blood thinners, common Rx interactions).
  - For emergent symptoms (chest pain, suicidal ideation, severe injury, breathing difficulty): redirect to 911 / emergency care **immediately** and do NOT recommend herbs.
  - For chronic conditions on Rx (e.g., diabetes, hypertension medication): explicitly note that herbs are supportive, not curative, and not a substitute for prescribed medication.
- **Formatting**: Markdown. Use brief headers per herb when discussing 2+ herbs. Cite web sources inline as links. For 1-herb or short responses, prefer prose.

### Client: `client/src/components/Chat.jsx`

- Renders message list (user + nutritionist turns)
- Streams nutritionist text into the in-flight message bubble
- Renders a row of `HerbCard` components inline within a nutritionist message when that message has `herbs` attached
- Bottom-anchored `ChatInput` with send / reset buttons

### Client: `client/src/hooks/useNutritionist.js`

- State: `messages: [{ role, content, herbs?, citations? }]`, `streaming: bool`, `error: string | null`
- `send(text)`: appends user message, opens fetch stream to the nutritionist Edge Function, accumulates `text_delta` into the latest nutritionist message, attaches `herb_results` payload to that message
- `reset()`: clears history
- Card rendering rule: only render `HerbCard` for herbs whose `id` came back from a `herb_search` tool call this turn — guarantees no hallucinated cards

### Client: `client/src/api/nutritionist.js`

- Uses `fetch()` directly (not `supabase.functions.invoke` — that buffers the full response). Sends `Authorization: Bearer <SUPABASE_ANON_KEY>` and parses SSE manually from the response body's `ReadableStream`.

### Rate limiting

Per-IP, two-window strategy via a Supabase Postgres table + atomic RPC. Checked at the start of every request *before* any Anthropic API call — so the cost-bearing tokens are never spent on a rejected request.

**Windows (configurable in the RPC):**
- 5 requests per minute (burst protection)
- 30 requests per day (cost cap)

**Identifier:** Client IP extracted from request headers. Supabase Edge Functions surface the client IP via `x-forwarded-for` (first hop) and `cf-connecting-ip` (Cloudflare-fronted). Fall back through both; reject with 400 if neither is present.

**Schema:**

```sql
CREATE TABLE nutritionist_rate_limits (
  ip TEXT PRIMARY KEY,
  minute_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  minute_count INT NOT NULL DEFAULT 0,
  day_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  day_count INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nutritionist_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Service role bypasses RLS for the RPC.
```

**RPC:** `check_nutritionist_rate_limit(client_ip TEXT, minute_limit INT DEFAULT 5, day_limit INT DEFAULT 30)` returning `(allowed BOOLEAN, minute_remaining INT, day_remaining INT, retry_after_seconds INT)`. Atomically:

1. Upsert the row for `client_ip`.
2. If `minute_window_start` is older than 1 minute, reset `minute_count = 0` and `minute_window_start = NOW()`.
3. Same for the day window.
4. If either count is already at the limit, return `allowed = false` with `retry_after_seconds` set to seconds until the earlier-resetting window expires (without incrementing).
5. Otherwise increment both counters and return `allowed = true` with remaining counts.

**Response when limit hit:** HTTP 429 with body `{ error: "rate_limit", retry_after_seconds }` and `Retry-After: <seconds>` header. Limit check happens *before* the SSE stream opens, so no mid-stream error path is needed.

**Local dev bypass:** when `APOTHECARY_ENV === "development"`, skip the RPC call. Set in local `.env`.

**Client UX:** the chat input catches 429 from `useNutritionist.send()` and renders a friendly inline notice with a countdown derived from `retry_after_seconds`. Input disabled during the cooldown.

### Routing

- Add `react-router-dom` (currently no router in client).
- Routes: `/` (existing search), `/nutritionist` (new chat page).
- Add header nav with two links.

---

## Implementation Phases

### Phase 1 — Backend: agent loop + tools + rate limiting

**Tasks:**
- [ ] Create migration `supabase/migrations/YYYYMMDD_create_nutritionist_rate_limits.sql` — table + `check_nutritionist_rate_limit` RPC + RLS
- [ ] Create `supabase/functions/nutritionist/` with `index.ts` + `deno.json`
- [ ] Create `supabase/functions/_shared/anthropic.ts` — initializes `Anthropic` from `npm:@anthropic-ai/sdk`
- [ ] Create `supabase/functions/_shared/tools.ts` — tool schemas
- [ ] Create `supabase/functions/_shared/sse.ts` — SSE helpers (headers, event encoder)
- [ ] Create `supabase/functions/_shared/rate-limit.ts` — IP extraction + RPC wrapper
- [ ] Implement `executeHerbSearch` (uses existing `_shared/embedding.ts` + `match_herbs` RPC)
- [ ] Implement agent loop: stream → tool dispatch → continue until `end_turn`, capped at 6 iterations
- [ ] Wire Anthropic-hosted `web_search` server tool
- [ ] Add request validation for `{ messages }` (extend `_shared/validation.ts`)
- [ ] Add rate-limit check at handler entry; return 429 + `Retry-After` on limit; bypass when `APOTHECARY_ENV=development`
- [ ] Add `ANTHROPIC_API_KEY` and `APOTHECARY_ENV` to local `.env` and Supabase secrets
- [ ] Add error handling: emit SSE `error` event for auth/network failures

**Files:**
- `supabase/migrations/YYYYMMDD_create_nutritionist_rate_limits.sql` (new)
- `supabase/functions/nutritionist/index.ts` (new)
- `supabase/functions/nutritionist/deno.json` (new)
- `supabase/functions/_shared/anthropic.ts` (new)
- `supabase/functions/_shared/tools.ts` (new)
- `supabase/functions/_shared/sse.ts` (new)
- `supabase/functions/_shared/rate-limit.ts` (new)
- `supabase/functions/_shared/validation.ts` (modify — add `validateNutritionistRequest`)

**Success criteria:**
- `curl` to the function with a query produces a streaming SSE response with `text_delta`, `herb_results`, and `done` events
- Multi-turn: sending prior `messages` array preserves context
- Herb search results match `/search` for the same query
- Loop terminates within 6 iterations
- 6th request within a minute returns HTTP 429 with `Retry-After` header (no tokens consumed)
- Local dev bypass works when `APOTHECARY_ENV=development`

### Phase 2 — System prompt + safety tuning

**Tasks:**
- [ ] Draft initial system prompt (persona, **humanlike voice rules**, workflow, Open anchoring, safety baseline, formatting)
- [ ] Extract to `supabase/functions/_shared/prompts/nutritionist.ts` if it grows beyond ~50 lines
- [ ] Run manual eval suite (see tasks doc) — golden path, clarification, safety, anchoring, **humanlike voice**
- [ ] Iterate prompt until evals pass

**Success criteria:**
- Lead recommendation always comes from KB when matches exist
- Clarifying questions feel natural (single question, not interrogation)
- Safety footer appears reliably and reads humanlike (not stiff/legal)
- Emergent symptoms → redirect without herb recommendation
- Contraindications surfaced for pregnancy / blood thinner / Rx scenarios
- Responses pass the "read aloud" test: contractions, varied rhythm, no AI-tell phrases, no templated sign-offs

### Phase 3 — Client chat UI

**Tasks:**
- [ ] Install `react-router-dom`; wire `/` and `/nutritionist` routes in `App.jsx`
- [ ] Create `client/src/api/nutritionist.js` — `fetch` + SSE parsing
- [ ] Create `client/src/hooks/useNutritionist.js`
- [ ] Create `Chat.jsx`, `ChatMessage.jsx`, `ChatInput.jsx` (+ co-located CSS)
- [ ] Render markdown in nutritionist messages (`react-markdown`)
- [ ] Render `HerbCard` row inline when message has `herbs`
- [ ] Create `pages/Nutritionist.jsx` composing the chat
- [ ] Empty state with 4–5 starter prompt chips
- [ ] Streaming indicator, error inline display
- [ ] Mobile-responsive layout

**Files:**
- `client/src/App.jsx` (modify — router)
- `client/src/api/nutritionist.js` (new)
- `client/src/hooks/useNutritionist.js` (new)
- `client/src/components/Chat.jsx` + `.css` (new)
- `client/src/components/ChatMessage.jsx` + `.css` (new)
- `client/src/components/ChatInput.jsx` + `.css` (new)
- `client/src/pages/Nutritionist.jsx` + `.css` (new)
- `client/src/components/NavBar.jsx` + `.css` (new)

**Success criteria:**
- User can send a query and watch streaming text + inline cards
- Multi-turn maintains visible context
- "New chat" / reset clears state
- Errors display inline
- Layout works on mobile (<= 480px width)

### Phase 4 — Polish & docs

**Tasks:**
- [ ] Token usage logging per turn (server logs)
- [ ] Decide rate-limit strategy (per-IP via Supabase or skip for v1)
- [ ] Update `docs/architecture.md` — add Nutritionist section + diagram
- [ ] Update `docs/changelog.md` — milestone entry
- [ ] Update root `README.md` — nutritionist feature blurb + `ANTHROPIC_API_KEY` setup note
- [ ] Demo screenshots / short GIF for README

---

## Acceptance Criteria

### Functional

- [ ] User can have a multi-turn conversation with the nutritionist
- [ ] Nutritionist calls `herb_search` and grounds recommendations in the 134-herb catalog
- [ ] Nutritionist calls `web_search` to enrich recommendations with current information
- [ ] Responses stream in real-time, no all-at-once wait
- [ ] Herb cards for KB herbs appear inline with the nutritionist's text
- [ ] Nutritionist asks a clarifying question for vague queries
- [ ] Nutritionist may surface non-catalog herbs from web search, marked clearly as outside the catalog
- [ ] Safety footer present on every response
- [ ] Emergent symptoms produce a medical-redirect response with no herb recommendation
- [ ] Responses sound humanlike: contractions, varied rhythm, no AI-tell phrases, no templated sign-offs, prose for short replies

### Non-Functional

- [ ] First text token appears within 3 seconds on a warm Edge Function
- [ ] Full turn completes within Edge Function timeout (<150s free tier)
- [ ] `ANTHROPIC_API_KEY` never exposed to clients
- [ ] Existing `/search` UX continues to work unchanged
- [ ] Plain CSS, co-located with components (matches repo convention)
- [ ] No new client deps beyond `react-router-dom` and `react-markdown`
- [ ] Rate limiting enforced: max 5 req/min and 30 req/day per IP; returns HTTP 429 with `Retry-After` when exceeded

---

## Dependencies & Prerequisites

- Anthropic API key with web_search tool access — set as Supabase secret `ANTHROPIC_API_KEY` and local `.env`
- Existing `match_herbs` RPC and `herbs` table (already deployed)
- Supabase Edge Functions runtime (already in use)
- `@anthropic-ai/sdk` via `npm:` specifier in Deno
- New migration: `nutritionist_rate_limits` table + `check_nutritionist_rate_limit` RPC (Phase 1)
- Local `.env`: `APOTHECARY_ENV=development` to bypass rate limits during local dev

---

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Edge Function timeout on long agent loops | Mid-conversation error | Cap iterations at 6; `max_uses: 5` on web_search; Sonnet default keeps latency low |
| Anthropic API cost spike from runaway loops | Bill shock | Hard iteration cap; log tokens per turn; optional per-session ceiling |
| Hallucinated herb names not in catalog rendered as cards | Confusing UX, broken cards | Client only renders cards for herb `id`s returned by the `herb_search` tool call this turn |
| Web search returns low-quality sources | Bad advice | Prompt biases toward NIH / examine.com / PubMed; require inline citations |
| Safety failures (advice on emergent symptoms) | Liability, harm | Explicit redirect rules in prompt + manual eval coverage |
| SSE doesn't pass cleanly through Supabase Edge Function | No streaming | Validate early in Phase 1; fall back to chunked JSON if needed |
| Streaming + tool-use coordination errors | Garbled UX | Use SDK's `stream.finalMessage()`; serialize state machine carefully |
| Anonymous client hammers endpoint | Bill shock + service disruption | Per-IP rate limiting (5/min, 30/day) via Postgres-backed atomic RPC; 429 + `Retry-After` returned before any Anthropic call |
| Responses sound robotic / chatbot-y | Lost trust, weak product feel | Explicit humanlike voice rules in system prompt; humanlike eval gates Phase 2 acceptance |
| User reloads page mid-stream | Lost conversation | History is client-side only — accept as v1 limitation; persistence is stretch |

---

## Out of Scope (v1)

- **Mobile (Expo) app** — nutritionist is web-only for v1. The Expo app from PR #2 keeps its existing search experience untouched. Reusing the chat UI on mobile (SSE handling in React Native, different navigation context) is deferred.
- **Conversation persistence** — chats live in client memory only; lost on reload.
- **Web search domain filtering** — agent searches the open web with prompt-level bias toward credible sources. Allowlist / blocklist deferred until quality issues warrant.
- **Authenticated user accounts on the nutritionist** — open to all; rate limit is per-IP.
- **Automated evaluation harness** — manual eval suite for v1.

---

## Documentation Plan

- [ ] Update `docs/architecture.md` — add Nutritionist Edge Function, chat components, agent loop diagram, SSE protocol
- [ ] Update `docs/changelog.md` — milestone entry on completion
- [ ] Update root `README.md` — nutritionist feature blurb + env var note

---

## References

### Internal
- Edge Function pattern: `supabase/functions/search/index.ts`
- Shared modules: `supabase/functions/_shared/{cors,embedding,response,types,validation}.ts`
- pgvector RPC: `match_herbs` (see `project_spec.md`)
- Search hook pattern: `client/src/hooks/useSearch.js`
- Search API pattern: `client/src/api/search.js`
- Herb card component: `client/src/components/HerbCard.jsx`
- Prior plan: `docs/plans/2026-03-31-feat-mobile-app-community-recipes-plan.md`

### External
- Anthropic Messages API (tool use): https://docs.anthropic.com/en/docs/build-with-claude/tool-use
- Anthropic web_search tool: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool
- Server-Sent Events (SSE): https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
