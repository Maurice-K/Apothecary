# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apothecary is a herbal wellness app with two experiences:
- **Herb Search (`/`)** — semantic search over 156 herbs using OpenAI embeddings + pgvector cosine similarity.
- **Nutritionist (`/nutritionist`)** — conversational AI nutritionist powered by Anthropic's API (tool-use + SSE streaming).

## Architecture

Three Edge Functions + a React SPA (`client/`).

**Search flow:** User query → `search` Edge Function → OpenAI embedding → `match_herbs` RPC (pgvector) → herb cards.

**Nutritionist flow:** User message → `nutritionist` Edge Function → agentic loop (Anthropic `claude-sonnet-4-6`) → `herb_search` tool (pgvector) + `web_search` tool (Anthropic-hosted) → SSE stream → chat UI with inline herb cards.

**Data pipeline:** Chioma's Shopify storefront → `scripts/enrich_herbs.js` (pulls tags, energetics, scientific name, plant part, origin, form) → `chioma_products.json` (156 herbs) → `scripts/ingest.js` embeds a multi-line labeled input (name → tags → category → energetics → plant_part → description) via OpenAI `text-embedding-3-small` → stores in Supabase `herbs` table with VECTOR(1536) column. High-signal labels go first so they aren't drowned by the long prose description; `how_to_use` is stored but not embedded (brewing instructions dilute signal). Search queries are prefixed with `"Herb for "` in `search/index.ts` and `_shared/tools.ts` to pull bare keywords closer to the document embeddings.

## Development Commands

```bash
# Edge Functions + Vite client together
npm run dev                       # local functions on :54321 + client on :5173

# Edge Functions only
npm run functions                 # wraps supabase functions serve --env-file .env --no-verify-jwt

# Data pipeline
npm run enrich                    # pull metadata from sources.json into chioma_products.json
npm run ingest                    # embed + upsert to LOCAL Supabase (default)
npm run ingest:prod               # embed + upsert to REMOTE — typed 'yes' confirmation required

# Catalog audit (no DB writes)
node scripts/compare_herbs.js     # diff Chioma site against chioma_products.json
node scripts/verify_search.js     # query failure cases against LOCAL match_herbs
node scripts/verify_search.js prod  # query against REMOTE

# Client only
cd client && npm run dev          # start Vite dev server
cd client && npm run build        # production build to client/dist/

# Deploy Edge Functions to remote (manual, intentional)
npx supabase functions deploy search nutritionist --project-ref donareoeoobqmomarisf
```

## API

**Search** (Supabase SDK):
```js
supabase.functions.invoke('search', { body: { query: "string", limit: 8 } })
// Returns: { results: [{
//   id, name, description, how_to_use, category,
//   tags, energetics, botanical_name, plant_part, origin, form,
//   similarity
// }] }
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

- `chioma_products.json` — source herb data (156 herbs, enriched with Shopify tags + HTML metadata)
- `scripts/sources.json` — URLs to crawl for catalog comparison and enrichment. Add new sources here.
- `scripts/enrich_herbs.js` — crawls sources.json (Shopify JSON + product HTML) and merges tags/energetics/scientific_name/plant_part/origin/form into chioma_products.json. Idempotent.
- `scripts/ingest.js` — embeds herbs and upserts to Supabase. Defaults to LOCAL; pass `prod` to target remote (with confirmation).
- `scripts/compare_herbs.js` — diffs Chioma site catalog against chioma_products.json.
- `scripts/verify_search.js` — runs canned failure queries against `match_herbs` for before/after checks.
- `supabase/functions/search/index.ts` — search Edge Function (prepends "Herb for " stem)
- `supabase/functions/nutritionist/index.ts` — nutritionist Edge Function (agentic loop + SSE)
- `supabase/functions/_shared/` — CORS, embedding, types, validation, anthropic, tools, sse, rate-limit
- `client/src/api/nutritionist.js` — fetch + SSE parser for the nutritionist
- `client/src/hooks/useNutritionist.js` — chat state (messages, streaming, error, send, reset)
- `client/src/hooks/useSearch.js` — search state
- `docs/architecture.md` — full system design including agent loop and SSE protocol

## Supabase

The `herbs` table uses pgvector. Columns: `id`, `name` (UNIQUE), `description`, `how_to_use`, `category` (text[]), `tags` (text[]), `energetics` (text[]), `botanical_name`, `plant_part`, `origin`, `form`, `embedding` (vector(1536)), `created_at`. The `match_herbs` SQL function returns all of these plus `similarity`, performing cosine similarity search with a configurable threshold (default 0.3) and result limit. Indexes: ivfflat on `embedding` (`lists = 10`, appropriate for <1000 rows) and GIN on `tags` (future-proofing for tag filtering). Ingestion upserts on `name` — re-running updates existing rows.

**Remote project:** `donareoeoobqmomarisf`. Local stack runs at `127.0.0.1:54321` via `supabase start`. Migrations live in `supabase/migrations/`; apply locally with `npx supabase migration up --local` and to remote with `npx supabase db push`.

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

- Root `.env` — production credentials: `OPENAI_API_KEY`, `SUPABASE_URL` (remote), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `APOTHECARY_ENV=development`.
- Root `.env.local` — local-Supabase overrides: `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Node scripts (`ingest`, `verify_search`) load this first by default so they target the local stack; `.env` fills in keys `.env.local` doesn't define (like `OPENAI_API_KEY`).
- `client/.env.local` — Vite: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Independent of the root `.env.local`.

## Conventions

- Plain CSS co-located with components (no Tailwind, no CSS-in-JS)
- Edge Functions use Deno/TypeScript; client uses plain JavaScript with JSX
- Search uses `supabase.functions.invoke`; nutritionist uses raw `fetch` (SSE requires it)
- `APOTHECARY_ENV=development` bypasses rate limiting locally
