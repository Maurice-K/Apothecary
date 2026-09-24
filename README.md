# Apothecary

A herbal wellness app ("The Herbary", live at [herbary.app](https://herbary.app)) with two experiences:

- **Nutritionist** (`/`, the landing page) — a conversational AI nutritionist that answers multi-turn wellness questions, grounds recommendations in the 156-herb catalog, and enriches advice with live web search.
- **Herb Search** (`/herb-search`) — type plain English queries like "what helps with sleep?" and get matching herbs as cards, ranked by semantic similarity.

> **Not live yet:** community recipes and user accounts (login/signup) exist in the code but aren't set up for real users, and the Expo app in `mobile/` is parked. The web client is the only live surface.

Built with React, Supabase Edge Functions, OpenAI embeddings + the OpenAI Responses API, and pgvector.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (required by Supabase CLI for local development)
- An [OpenAI API key](https://platform.openai.com/api-keys) (used for embeddings and the Nutritionist)

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/Maurice-K/Apothecary.git
cd Apothecary
npm install
cd client && npm install && cd ..
```

### 2. Start Supabase locally

```bash
npx supabase start
```

This starts a local Supabase stack (Postgres on port 54322, API on port 54321, Studio on port 54323). On first run it will pull Docker images which may take a few minutes.

Once started, the CLI prints your local credentials (`anon key`, `service_role key`, `API URL`). You'll need these for the next step.

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
OPENAI_API_KEY=<your OpenAI API key>
APOTHECARY_ENV=development
```

Create a `.env.local` file in the `client/` directory:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start>
```

### 4. Ingest herb data

This embeds all 156 herbs from `chioma_products.json` and uploads them to your local Supabase database. Safe to re-run.

```bash
npm run ingest
```

### 5. Start the app

Run everything with a single command:

```bash
npm run dev
```

This starts both the Supabase Edge Functions and the Vite dev server. Or run them separately:

```bash
# Terminal 1 - Edge Functions (--no-verify-jwt skips JWT check locally)
npx supabase functions serve --env-file .env --no-verify-jwt

# Terminal 2 - React client
cd client && npm run dev
```

### 6. Open the app

- **Nutritionist:** http://localhost:5173
- **Herb Search:** http://localhost:5173/herb-search
- **Supabase Studio:** http://localhost:54323 (database admin UI)

## Testing

End-to-end tests run on [TestSprite](https://www.testsprite.com), an AI browser agent that clicks through the app like a user and checks what it sees. It runs against your **local** app through a secure tunnel, so you can test changes before deploying.

**One-time setup**

```bash
npm install -g @testsprite/testsprite-cli   # installs the `testsprite` command
testsprite setup                            # paste your TestSprite API key; installs agent skills
testsprite auth status                      # confirm you're signed in
```

**Run tests** (with `npx supabase start` and `npm run dev` already running):

```bash
testsprite test list --project 84f4b903-69fa-4200-b9e6-e574d24e6edb   # see tests + ids
testsprite test run <testId> --local 5173 --local-host ::1           # run one test (~2–5 min)
testsprite test steps <testId>                                       # step-by-step result of the last run
testsprite test open <testId>                                        # open it in the dashboard (video, history)
```

- Test plans live in [`testsprite/plans/`](testsprite/plans/); see [`testsprite/README.md`](testsprite/README.md). To add a test, write a plan JSON and run `testsprite test create --plan-from <file> --project <id>`.
- The active suite is plans 01–07 (nutritionist + herb search). Tests tagged `[AUTH — not live]` are parked until accounts launch.
- Each run costs 0.5 TestSprite credits (Free plan: 150/month), so run the tests that cover your change rather than the whole suite.

Search-ranking changes are checked separately with `node scripts/verify_search.js`.

## Project Structure

```
Apothecary/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── api/             # Supabase client and search calls
│       ├── components/      # UI components (NavBar, HerbCard, etc.)
│       ├── hooks/           # Custom React hooks (useSearch, useNutritionist, useAuth)
│       └── pages/           # Page components (Nutritionist, HomePage/search, recipes, auth)
├── supabase/
│   ├── functions/           # Deno Edge Functions (search, recipes-search, recipes, nutritionist)
│   │   └── _shared/        # Shared utilities (CORS, embedding, types)
│   └── migrations/          # SQL migrations (herbs table, pgvector)
├── mobile/                  # Expo / React Native app (parked)
├── scripts/                 # Herb enrichment, ingestion, and search verification
├── testsprite/plans/        # TestSprite end-to-end test plans
├── chioma_products.json     # Source herb data (156 herbs)
└── docs/                    # Architecture, changelog, plans
```

## Tech Stack

- **Frontend:** React 19, React Router, Vite, plain CSS
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Database:** PostgreSQL with pgvector (cosine similarity search)
- **Embeddings:** OpenAI `text-embedding-3-small`
- **AI:** OpenAI Responses API (`gpt-5-mini`) with function tools, hosted web search, and SSE streaming
- **Auth:** Supabase Auth (not live yet)
- **Storage:** Supabase Storage (recipe photos)
- **E2E testing:** TestSprite
