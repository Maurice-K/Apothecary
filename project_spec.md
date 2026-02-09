# Apothecary - Semantic Herb Search Web App

## Overview
A web app that lets users search ~134 bulk herbs using plain English queries (e.g., "what helps with sleep?"). Uses semantic search via OpenAI embeddings + Supabase pgvector to return relevant herbs as cards with descriptions and usage info.

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite (SPA) |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase (PostgreSQL + pgvector) |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dimensions) |
| Data Source | `chioma_products.json` — 134 herbs with `name`, `description`, `how_to_use`, `category` |

---

## Prerequisites (set up before building)

### 1. GitHub Repository
- Repo: `https://github.com/Maurice-K/Apothecary.git`
- Init remote: `git remote add origin https://github.com/Maurice-K/Apothecary.git`

### 2. OpenAI API Key
- Create an account at https://platform.openai.com
- Generate an API key at https://platform.openai.com/api-keys
- You need access to the `text-embedding-3-small` model
- Estimated cost for this project: ~$0.0002 for initial ingestion, ~$0.00002 per search query

### 3. Supabase Project
- Create a free account at https://supabase.com
- Create a new project
- Note down these three values from Project Settings > API:
  - **Project URL** (e.g., `https://your-project.supabase.co`)
  - **Anon/Public key** (used by the client at runtime)
  - **Service Role key** (used only by the ingestion script — keep secret)
- Install the Supabase CLI: `npm install -g supabase`

---

## Project Structure
```
Apothecary/
├── .env                          # API keys (never commit this)
├── .gitignore
├── chioma_products.json          # existing herb data
├── package.json                  # ingestion script deps (dotenv, openai, @supabase/supabase-js)
│
├── scripts/
│   └── ingest.js                 # one-time: embed herbs + upload to Supabase
│
├── supabase/
│   └── functions/
│       └── search/
│           └── index.ts          # Edge Function: embed query → match_herbs RPC → results
│
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               # top-level layout
│       ├── App.css               # global styles
│       ├── api/
│       │   └── search.js         # calls supabase.functions.invoke('search', ...)
│       ├── hooks/
│       │   └── useSearch.js      # manages results, loading, error state
│       └── components/
│           ├── SearchBar.jsx     # text input + submit button
│           ├── SearchBar.css
│           ├── HerbCard.jsx      # single result card (includes category tags)
│           ├── HerbCard.css
│           ├── HerbCardList.jsx  # maps results to HerbCard components
│           ├── HerbCardList.css
│           ├── LoadingSpinner.jsx
│           └── EmptyState.jsx    # welcome message or "no results"
```

---

## Environment Variables

Create a `.env` file in the project root with these values:

```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
```

`SUPABASE_SERVICE_ROLE_KEY` is only needed for the ingestion script. Edge Functions use Supabase's built-in environment for `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The `OPENAI_API_KEY` must be set as an Edge Function secret via `supabase secrets set OPENAI_API_KEY=sk-...`.

---

## Step-by-Step Implementation

### Step 1: Project Scaffolding

**Goal:** Set up the directory structure, install dependencies.

1. Initialize git, create `.gitignore` (node_modules, .env, dist, .supabase)
2. Create root `package.json` with ingestion script dependencies:
   - `dotenv` — load .env file
   - `@supabase/supabase-js` — Supabase client
   - `openai` — OpenAI SDK
3. Initialize Supabase: `supabase init`
4. Create the search edge function: `supabase functions new search`
5. Scaffold `client/` with Vite: `npm create vite@latest client -- --template react`
6. Install client dependencies: `cd client && npm install @supabase/supabase-js`
7. Create `.env` with placeholder values

**Verify:** `cd client && npm run dev` shows the Vite welcome screen. `supabase functions serve` starts the local edge function runtime.

---

### Step 2: Supabase Database Setup

**Goal:** Create the herbs table and similarity search function.

Run these SQL statements in your Supabase dashboard (SQL Editor > New query):

```sql
-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the herbs table
CREATE TABLE herbs (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  how_to_use  TEXT NOT NULL,
  category    TEXT[] NOT NULL,
  embedding   VECTOR(1536) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create an index for fast similarity search
CREATE INDEX ON herbs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);

-- 4. Create the similarity search function
CREATE OR REPLACE FUNCTION match_herbs (
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count     INT   DEFAULT 10
)
RETURNS TABLE (
  id          BIGINT,
  name        TEXT,
  description TEXT,
  how_to_use  TEXT,
  category    TEXT[],
  similarity  FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    herbs.id,
    herbs.name,
    herbs.description,
    herbs.how_to_use,
    herbs.category,
    1 - (herbs.embedding <=> query_embedding) AS similarity
  FROM herbs
  WHERE 1 - (herbs.embedding <=> query_embedding) > match_threshold
  ORDER BY herbs.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**Verify:** The `herbs` table appears in the Table Editor with a `category` column of type `text[]`. The `match_herbs` function appears under Database > Functions.

---

### Step 3: Data Ingestion Script

**Goal:** Embed all 134 herbs and store them in Supabase.

**File:** `scripts/ingest.js`

**What it does:**
1. Reads `chioma_products.json`
2. For each herb, creates the embedding input text: `"<name>: <description>"`
   - Only `name + description` are embedded — `how_to_use` and `category` are not embedded
   - `how_to_use` is stored for display; `category` is stored for display/filtering
3. Calls OpenAI embeddings API in a single batch (134 items, ~10K tokens)
4. Upserts all rows (name, description, how_to_use, category, embedding) into Supabase
   - Uses `name` as the conflict key (UNIQUE constraint)
   - On conflict: updates `description`, `how_to_use`, `category`, and `embedding`
   - Safe to run multiple times — re-running updates existing herbs and adds new ones

**Run:** `node scripts/ingest.js`

**Cost:** ~$0.0002 per run (effectively free)

**Verify:** Check Supabase Table Editor — should have 134 rows, each with a non-null embedding and a populated `category` array. Running again should not create duplicates.

---

### Step 4: Supabase Edge Function (Search)

**Goal:** Build the search function that converts queries to embeddings and finds matching herbs.

**File:** `supabase/functions/search/index.ts`

**What it does:**
1. Receives a JSON request body: `{ "query": "what helps with sleep?", "limit": 8 }`
2. Generates an embedding for the query via OpenAI `text-embedding-3-small`
3. Calls `supabase.rpc('match_herbs', { query_embedding, match_threshold: 0.3, match_count: limit })`
4. Returns `{ "results": [{ id, name, description, how_to_use, category, similarity }, ...] }`

**Invocation:** `supabase.functions.invoke('search', { body: { query, limit } })`

**Local dev:** `supabase functions serve` (serves functions locally with hot reload)

**Verify:**
```bash
curl -X POST http://localhost:54321/functions/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -d '{"query": "what helps with sleep?"}'
```
Should return Valerian Root, Chamomile, Passionflower, Lavender, etc.

---

### Step 5: React Frontend

**Goal:** Build the search UI with herb result cards.

**Components:**
| Component | Purpose |
|-----------|---------|
| `App.jsx` | Top-level layout, holds search state via `useSearch` hook |
| `SearchBar` | Text input + submit button. Placeholder: "Search for herbs..." |
| `HerbCardList` | Maps results array to HerbCard components |
| `HerbCard` | Displays herb name, description, collapsible how-to-use, category tags, similarity badge |
| `LoadingSpinner` | Shown while search is in progress |
| `EmptyState` | Welcome message (initial) or "No herbs matched" (after empty search) |

**Key frontend files:**
- `useSearch.js` hook — manages `results`, `loading`, `error`, `hasSearched` state
- `api/search.js` — calls `supabase.functions.invoke('search', { body: { query, limit } })` using `@supabase/supabase-js`
- Client needs `@supabase/supabase-js` as a dependency (initialised with `SUPABASE_URL` and `SUPABASE_ANON_KEY`)

**Verify:** Open `http://localhost:5173`, type a query, see herb cards appear with category tags.

---

### Step 6: Styling

**Theme:** Warm, earthy apothecary aesthetic
- **Colors:** Forest green, cream/off-white, terracotta accents
- **Layout:** Centered, max-width 800px, generous padding
- **Cards:** Subtle border or shadow, hover state. Category tags as small coloured pills.
- **Search bar:** Prominent, centered at top
- **Responsive:** Single-column layout stacks naturally on mobile

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Embed `name + description` only | `how_to_use` has brewing instructions that dilute semantic signal for benefit-based searches |
| Category is NOT embedded | Category is metadata for display and future filtering — embedding it would not improve semantic search quality |
| Cosine similarity threshold 0.3 | Low enough to avoid empty results; relevant matches typically score 0.5+. Tune after testing |
| Plain CSS (no Tailwind) | 5-6 components don't justify the setup overhead |
| No authentication | Read-only search tool; API keys stay server-side (in Edge Function secrets) |
| No TypeScript on client | Keeps client setup simple for this project size. Edge Functions use TypeScript (Deno requirement) |
| Supabase Edge Functions (not Express) | Eliminates a separate server to deploy/manage. Edge Functions run close to the database, reducing latency. Built-in auth and secrets management. |

---

## Test Queries (to validate after building)

| Query | Expected Top Results |
|-------|---------------------|
| "what helps with sleep?" | Valerian Root, Chamomile, Passionflower, Lavender, Catnip |
| "herbs for digestion" | Senna Leaf, Fennel Seed, Peppermint, Ginger Root, Dandelion Root |
| "immunity boost" | Elderberries, Echinacea, Astragalus Root, Chaga Mushroom |
| "stress and anxiety" | Ashwagandha, Skullcap, Passionflower, Lemon Balm, Tulsi |
| "women's health" | Raspberry Leaf, Vitex Chasteberry, Shatavari Root, Dong Quai |
| "something for my skin" | Burdock Root, Calendula, Neem Leaf, Chickweed |
| "liver support" | Milk Thistle, Dandelion Root, Schisandra Berry |

---

## Future Enhancements (post-MVP)

- **Category filtering** — allow users to filter search results by category (e.g., "Digestive Support")
- **Query caching** — cache recent query embeddings to skip redundant OpenAI calls
- **Re-ingestion** — if herbs are added/changed in `chioma_products.json`, just re-run `node scripts/ingest.js` (upsert handles updates automatically)
