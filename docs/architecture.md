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
    │  1. Calls OpenAI text-embedding-3-small to embed the query
    │  2. Calls match_herbs RPC (pgvector cosine similarity)
    ▼
Supabase PostgreSQL + pgvector
    │  Returns ranked herbs (id, name, description, how_to_use, category, similarity)
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
| HerbCard | Displays name, description, how_to_use, category tags, similarity |
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
    │  2. Run agentic tool-use loop (max 6 iterations):
    │     a. Stream openai.responses.create({ stream: true, tools, ... })
    │     b. Forward response.output_text.delta → SSE event: text_delta
    │     c. On response.completed: dispatch any function_call items
    │        • herb_search → embed query → match_herbs RPC → SSE: herb_results
    │        • web_search  → OpenAI-hosted, no client execution needed
    │     d. Append function_call_output items to input, continue loop
    │  3. When no function_calls remain: SSE event: done
    ▼
React client
    │  Accumulates text_delta into streaming message bubble
    │  Attaches herb_results as inline HerbCard row
```

### SSE event protocol

| Event | Data | Description |
|-------|------|-------------|
| `text_delta` | `{ delta: string }` | Incremental text from the model |
| `herb_results` | `{ herbs: Herb[] }` | Herbs returned by herb_search tool |
| `tool_use` | `{ name, input }` | Tool call being dispatched |
| `done` | `{}` | Stream complete |
| `error` | `{ message: string }` | Agent or auth error |

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
| `_shared/herb-search.ts` | `searchHerbs(query, limit)` — embeds with the `"Herb for "` stem and calls the `match_herbs` RPC (used by both the search and nutritionist functions) |
| `_shared/tools.ts` | Tool definitions (`HERB_SEARCH_TOOL`, `WEB_SEARCH_TOOL`) + `HerbSearchInputSchema` Zod schema |
| `_shared/sse.ts` | SSE stream helpers |
| `_shared/rate-limit.ts` | IP extraction + rate-limit RPC wrapper |
