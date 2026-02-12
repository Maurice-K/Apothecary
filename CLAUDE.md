# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apothecary is a semantic herb search web app. Users type plain English queries (e.g., "what helps with sleep?") and get matching herbs displayed as cards. The search uses OpenAI embeddings stored in Supabase pgvector for cosine similarity matching.

## Architecture

Two-part app: a Supabase Edge Function (`supabase/functions/search/`) and a React SPA (`client/`).

**Search flow:** User query → Supabase Edge Function → OpenAI embedding → Supabase `match_herbs` RPC (pgvector cosine similarity) → ranked herb results → React card UI.

**Data pipeline:** `chioma_products.json` (134 herbs) → `scripts/ingest.js` embeds `"<name>: <description>"` via OpenAI `text-embedding-3-small` → stores in Supabase `herbs` table with VECTOR(1536) column. Only `name + description` are embedded; `how_to_use` and `category` are stored but not embedded (brewing instructions and metadata dilute semantic signal).

## Development Commands

```bash
# Edge Function (local dev on port 54321)
supabase functions serve          # start local edge function runtime

# Ingestion (one-time)
node scripts/ingest.js            # embed herbs + upload to Supabase

# Client (React + Vite on port 5173)
cd client && npm run dev          # start Vite dev server
cd client && npm run build        # production build to client/dist/
```

## API

The search is invoked via the Supabase client SDK:

```js
supabase.functions.invoke('search', { body: { query: "string", limit: 8 } })
```

Returns: `{ "results": [{ id, name, description, how_to_use, category, similarity }] }`

## Key Files

- `chioma_products.json` — source herb data (name, description, how_to_use, category)
- `scripts/ingest.js` — data ingestion (reads JSON, generates embeddings, upserts to Supabase). Safe to re-run.
- `supabase/functions/search/index.ts` — Edge Function: embed query → pgvector similarity search → results
- `client/src/hooks/useSearch.js` — React state management for search (results, loading, error)
- `client/src/api/search.js` — calls `supabase.functions.invoke('search', ...)`
- `project_spec.md` — full implementation spec with SQL, test queries, and design decisions

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

## Conventions

- Plain CSS co-located with components (no Tailwind, no CSS-in-JS)
- Environment variables loaded from root `.env` via dotenv (ingestion script only)
- Edge Functions use Deno/TypeScript; client uses plain JavaScript with JSX
- Client uses `@supabase/supabase-js` to invoke Edge Functions (no REST fetch calls)
