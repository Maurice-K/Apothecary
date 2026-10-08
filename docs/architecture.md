# Architecture

## System Overview

Apothecary is a two-part app: a **Supabase Edge Function** handles search logic and a **React SPA** provides the UI.

```
User query
    │
    ▼
React Client (Vite)
    │  supabase.functions.invoke('search', { body: { query, limit } })
    ▼
Supabase Edge Function (supabase/functions/search/index.ts)
    │  1. Calls OpenAI text-embedding-3-small to embed "Herb for {query}"
    │  2. Calls match_herbs RPC (pgvector cosine similarity) for 25 candidates
    │  3. Re-ranks the candidates with Cohere Rerank (rerank-v4.0-fast)
    │     against the raw query and keeps the top `limit`
    ▼
Returns ranked herbs (all herb columns, similarity, relevance)
    ▼
React Client renders HerbCard list
```

## Data Layer

### herbs table

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL | Primary key |
| name | TEXT | UNIQUE — used as upsert key |
| description | TEXT | |
| how_to_use | TEXT | Stored for display, not embedded |
| category | TEXT[] | Array of category strings, not embedded |
| embedding | VECTOR(1536) | OpenAI text-embedding-3-small |
| created_at | TIMESTAMPTZ | Default NOW() |

### match_herbs RPC

Cosine similarity search function. Accepts `query_embedding`, `match_threshold` (default 0.3), and `match_count` (default 10). Returns rows ordered by similarity descending.

### Indexing

ivfflat index with `lists = 10`, appropriate for <1000 rows.

## Ingestion Pipeline

```
chioma_products.json (156 herbs)
    │  node scripts/ingest.js
    ▼
OpenAI text-embedding-3-small
    │  Embeds "<name>: <description>" for each herb
    ▼
Supabase herbs table
    │  Upsert on name — safe to re-run
```

Only `name + description` are embedded. `how_to_use` (brewing instructions) and `category` (metadata) are stored but excluded from the embedding to keep semantic signal focused on health benefits.

## Edge Function

`supabase/functions/search/index.ts` (Deno/TypeScript)

- Receives `{ query, limit }` via POST
- Embeds the query with OpenAI
- Calls `match_herbs` RPC
- Returns `{ results: [...] }`
- Deployed via `supabase functions deploy search`
- Local dev via `supabase functions serve`

## Client

React SPA built with Vite. Two pages: `/` (herb search) and `/nutritionist` (chat). Plain CSS co-located with components.

### Key components

| Component | Role |
|-----------|------|
| App.jsx | Router, layout |
| NavBar | Links to Search and Nutritionist pages |
| SearchBar | Text input + submit |
| HerbCardList | Maps search results to HerbCard components |
| HerbCard | Displays name, description, how_to_use, category tags, "% match" badge (rerank `relevance`, else `similarity`) |
| Chat | Scrollable message list with auto-scroll |
| ChatMessage | User bubble or nutritionist markdown bubble with inline HerbCards |
| ChatInput | Auto-grow textarea, Enter to send, rate-limit countdown |
| LoadingSpinner | Shown during search |
| EmptyState | Welcome message or "no results" |

---

## Conversational Nutritionist

An agentic chat feature that answers herbal wellness questions using the 156-herb catalog as the primary signal, enriched with live web search.

### Agent loop

```
React client (/nutritionist)
    │  POST { messages } — full conversation history each turn
    │  SSE stream (fetch + ReadableStream reader)
    ▼
supabase/functions/nutritionist/index.ts
    │  1. Validate request + check per-IP rate limit
    │  2. Ask Jev which stage the conversation is in → SSE event: stage
    │     (diagnostic | treatment | aftercare | chat | emergency | fallback)
    │     The stage sets the prompt block and which tools the model gets
    │  3. Run agentic tool-use loop (max 6 iterations):
    │     a. Stream openai.responses.create({ stream: true, tools, ... })
    │     b. Forward response.output_text.delta → SSE event: text_delta
    │     c. On response.completed: dispatch any function_call items
    │        • herb_search → searchHerbs (embed → match_herbs → rerank) → SSE: herb_results
    │        • web_search  → OpenAI-hosted, no client execution needed
    │     d. Append function_call_output items to input, continue loop
    │  4. When no function_calls remain: SSE event: done
    ▼
React client
    │  Accumulates text_delta into streaming message bubble
    │  Attaches herb_results as inline HerbCard row
```

### Stage gate (Jev)

Herb cards only appear once the nutritionist understands the user's concern. Before the agent loop, `decideStage()` in `_shared/jev.ts` sends the last 12 messages (2,000 chars each) to **Jev**, TypeSafe AI's decision model, through TypeSafe's System One API (`POST https://api.typesafe.ai/v1/systemone`, model `jev-1.13.0`). Jev never writes text. It answers four typed questions with probabilities:

- `stage` (choice): `diagnostic` | `treatment` | `aftercare` | `chat` | `emergency`
- `questions_answered` (noul): the user's latest message answers most of the assistant's clarifying questions
- `skip_requested` (noul): the user asked to skip questions and get recommendations now
- `already_probed` (noul): the assistant has already asked about this concern in two or more replies

Thresholds in code turn the answers into a stage:

1. `p(emergency) ≥ 0.3` → emergency.
2. Jev picks `treatment` or `diagnostic`. The result is treatment if any of these hold:
   - `p(treatment) ≥ 0.5`;
   - `questions_answered ≥ 0.7`;
   - `skip_requested ≥ 0.7`;
   - `already_probed ≥ 0.8`.

   Otherwise it's diagnostic.
3. Otherwise Jev's top choice.

Why `questions_answered` exists:
- On a user's answers to the diagnostic questions, the `stage` choice is unreliable: it scored treatment anywhere from 0.49 to 0.64 in live runs.
- The `questions_answered` noul separates answers (about 0.9) from everything else (under 0.1), so it drives the diagnosis → treatment step.
- A complete first message, with what, how long, pattern, severity and meds all given, scores about 0.55–0.65 for treatment, so it skips diagnosis.
- `skip_requested` and `already_probed` cap diagnosis at two rounds of questions.

The stage decides the prompt block and the tools:

| Stage | Tools | Behavior |
|---|---|---|
| `diagnostic` | none | Acknowledge, ask 1–3 focused questions (duration, pattern, severity, meds/conditions), no herbs |
| `treatment` | `herb_search` (forced first) + `web_search` | Per-herb recommendations and cards; the search query folds in what the user told us |
| `aftercare` | `web_search` | Follow-up on herbs already shown, in prose |
| `chat` | none | Short reply |
| `emergency` | none | Send the user to emergency care |
| `fallback` | none on the first turn; `herb_search` + `web_search` after | Jev unreachable: the first message is treated as `diagnostic`; later turns let the model route itself, diagnose-first |

`herb_search` is only offered in `treatment` (and `fallback` after the first turn), so cards can't appear during diagnosis whatever the model decides. A pivot to a new concern mid-chat goes back to `diagnostic`. If `TYPESAFE_API_KEY` is missing, Jev errors or returns an unexpected shape, or it takes over 3 s, the stage is `fallback` and the chat keeps working. `scripts/verify_stage.js` checks the gate against labeled conversations and is the place to tune the thresholds.

### SSE event protocol

| Event | Data | Description |
|-------|------|-------------|
| `stage` | `{ stage }` | Stage Jev picked for this turn; sent once, before any text (the web client ignores it) |
| `text_delta` | `{ delta: string }` | Incremental text from the model |
| `herb_results` | `{ herbs: Herb[] }` | Herbs returned by herb_search tool |
| `tool_use` | `{ name, input }` | Tool call being dispatched |
| `done` | `{}` | Stream complete |
| `error` | `{ message: string }` | Agent or auth error |

Every stream ends with exactly one `done` or `error`. If the body closes without either, the client treats it as a dropped connection and reports an error rather than waiting forever.

**Cancellation:** `useNutritionist` gives each request its own `AbortController` and aborts it on "New chat" and on unmount. When the client disconnects, the edge runtime cancels the SSE `ReadableStream`. That aborts `sse.signal`, which is passed to `openai.responses.stream()`, so the in-flight OpenAI call and the rest of the agent loop stop. The runtime only notices the disconnect on its next write, so the loop can run until the next SSE event (usually a few seconds) before stopping.

### Rate limiting

Per-IP, two-window strategy backed by the `nutritionist_rate_limits` Postgres table and a `check_nutritionist_rate_limit` atomic RPC. Checked before any OpenAI API call. Returns HTTP 429 with `Retry-After` header when exceeded.

- 5 requests per minute (burst protection)
- 30 requests per day (cost cap)
- Bypassed when `APOTHECARY_ENV=development`

### New shared modules

| File | Purpose |
|------|---------|
| `_shared/openai.ts` | Initialises the OpenAI SDK client and exports `MODEL`, `MAX_ITERATIONS`, `MAX_OUTPUT_TOKENS` |
| `_shared/supabase.ts` | Service-role Supabase client (one instance, shared by `tools.ts`, `rate-limit.ts`, `herb-search.ts`) |
| `_shared/herb-search.ts` | `searchHerbs(query, limit)` — embeds with the `"Herb for "` stem, pulls 25 candidates from the `match_herbs` RPC and re-ranks them (used by both the search and nutritionist functions) |
| `_shared/rerank.ts` | `rerankHerbs(query, herbs, topN)` — Cohere Rerank over the herb text (same labeled format as `buildEmbeddingInput` in `scripts/ingest.js`), adds `relevance`; falls back to cosine order on a missing key, HTTP error or 2 s timeout |
| `_shared/jev.ts` | `decideStage(messages, signal)` — asks Jev for the conversation stage, applies the thresholds; `fallback` on a missing key, HTTP error, bad shape or 3 s timeout |
| `_shared/tools.ts` | Tool definitions (`HERB_SEARCH_TOOL`, `WEB_SEARCH_TOOL`) + `HerbSearchInputSchema` Zod schema |
| `_shared/sse.ts` | SSE stream helpers |
| `_shared/rate-limit.ts` | IP extraction + rate-limit RPC wrapper |
