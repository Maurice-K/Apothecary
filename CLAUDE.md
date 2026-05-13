# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apothecary is a herbal wellness app with two experiences:
- **Herb Search (`/`)** — semantic search over 134 herbs using OpenAI embeddings + pgvector cosine similarity.
- **Nutritionist (`/nutritionist`)** — conversational AI nutritionist powered by Anthropic's API (tool-use + SSE streaming).

## Architecture

Three Edge Functions + a React SPA (`client/`).

**Search flow:** User query → `search` Edge Function → OpenAI embedding → `match_herbs` RPC (pgvector) → herb cards.

**Nutritionist flow:** User message → `nutritionist` Edge Function → agentic loop (Anthropic `claude-sonnet-4-6`) → `herb_search` tool (pgvector) + `web_search` tool (Anthropic-hosted) → SSE stream → chat UI with inline herb cards.

**Data pipeline:** `chioma_products.json` (134 herbs) → `scripts/ingest.js` embeds `"<name>: <description>"` via OpenAI `text-embedding-3-small` → stores in Supabase `herbs` table with VECTOR(1536) column. Only `name + description` are embedded; `how_to_use` and `category` are stored but not embedded (brewing instructions and metadata dilute semantic signal).

## Development Commands

```bash
# Edge Functions (local dev on port 54321)
supabase functions serve --env-file .env --no-verify-jwt   # all functions; --no-verify-jwt needed locally

# Ingestion (one-time)
node scripts/ingest.js            # embed herbs + upload to Supabase

# Herb catalog comparison
node scripts/compare_herbs.js     # compare Chioma site catalog against chioma_products.json

# Client (React + Vite on port 5173)
cd client && npm run dev          # start Vite dev server
cd client && npm run build        # production build to client/dist/
```

## API

**Search** (Supabase SDK):
```js
supabase.functions.invoke('search', { body: { query: "string", limit: 8 } })
// Returns: { results: [{ id, name, description, how_to_use, category, similarity }] }
```

**Nutritionist** (raw fetch + SSE):
```js
fetch(`${SUPABASE_URL}/functions/v1/nutritionist`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
  body: JSON.stringify({ messages: [{ role: 'user', content: '...' }] })
})
// SSE events: text_delta | herb_results | tool_use | done | error
```

## Key Files

- `chioma_products.json` — source herb data (134 herbs)
- `scripts/ingest.js` — embeds herbs and upserts to Supabase. Safe to re-run.
- `scripts/sources.json` — list of URLs to crawl for herb catalog comparison. Add new sources here.
- `scripts/compare_herbs.js` — fetches product listings from sources.json via Shopify JSON API and diffs against chioma_products.json. Outputs which herbs are in the DB and which are missing.
- `supabase/functions/search/index.ts` — search Edge Function
- `supabase/functions/nutritionist/index.ts` — nutritionist Edge Function (agentic loop + SSE)
- `supabase/functions/_shared/` — CORS, embedding, types, validation, anthropic, tools, sse, rate-limit
- `client/src/api/nutritionist.js` — fetch + SSE parser for the nutritionist
- `client/src/hooks/useNutritionist.js` — chat state (messages, streaming, error, send, reset)
- `client/src/hooks/useSearch.js` — search state
- `docs/architecture.md` — full system design including agent loop and SSE protocol

## Supabase

The `herbs` table uses pgvector. Columns: `id`, `name` (UNIQUE), `description`, `how_to_use`, `category` (text[]), `embedding` (vector(1536)), `created_at`. The `match_herbs` SQL function performs cosine similarity search with a configurable threshold (default 0.3) and result limit. The ivfflat index uses `lists = 10` appropriate for <1000 rows. Ingestion uses upsert on `name` — re-running updates existing rows and adds new ones.

## Git & Branching

- **Repo:** `https://github.com/Maurice-K/Apothecary.git`
- `main` is always deployable — never commit directly to main
- Create feature branches off `main` with naming: `feature/<short-description>`, `fix/<short-description>`, `chore/<short-description>`
- Open PRs to merge back into `main`
- Branch examples: `feature/search-endpoint`, `fix/embedding-threshold`, `chore/update-deps`

## Documentation

Project docs live in `docs/`. Update these after major milestones and significant additions.

- [`docs/architecture.md`](docs/architecture.md) — system design, data model, search flow, component overview
- [`docs/changelog.md`](docs/changelog.md) — chronological log of major changes and milestones

- When completing a feature branch or milestone, update `docs/changelog.md` with a summary of what changed. Update `docs/architecture.md` when the system design, data model, or component structure changes.

## Environment Variables

Root `.env`: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `APOTHECARY_ENV=development`

`client/.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Conventions

- Plain CSS co-located with components (no Tailwind, no CSS-in-JS)
- Edge Functions use Deno/TypeScript; client uses plain JavaScript with JSX
- Search uses `supabase.functions.invoke`; nutritionist uses raw `fetch` (SSE requires it)
- `APOTHECARY_ENV=development` bypasses rate limiting locally
