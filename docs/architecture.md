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
chioma_products.json (134 herbs)
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

React SPA built with Vite. Calls the Edge Function via `@supabase/supabase-js` (no direct REST calls). Plain CSS co-located with components.

### Key components

| Component | Role |
|-----------|------|
| App.jsx | Layout, owns search state via useSearch hook |
| SearchBar | Text input + submit |
| HerbCardList | Maps results to HerbCard components |
| HerbCard | Displays name, description, how_to_use, category tags, similarity |
| LoadingSpinner | Shown during search |
| EmptyState | Welcome message or "no results" |
