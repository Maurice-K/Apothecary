# Apothecary

A semantic herb search web app. Type plain English queries like "what helps with sleep?" and get matching herbs displayed as cards. Built with React, Supabase Edge Functions, OpenAI embeddings, and pgvector.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (required by Supabase CLI for local development)
- An [OpenAI API key](https://platform.openai.com/api-keys)

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
```

Create a `.env.local` file in the `client/` directory:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start>
```

### 4. Ingest herb data

This embeds all 134 herbs from `chioma_products.json` and uploads them to your local Supabase database. Safe to re-run.

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
# Terminal 1 - Edge Functions
npx supabase functions serve

# Terminal 2 - React client
cd client && npm run dev
```

### 6. Open the app

- **App:** http://localhost:5173
- **Supabase Studio:** http://localhost:54323 (database admin UI)

## Project Structure

```
Apothecary/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── api/             # Supabase client and search calls
│       ├── components/      # UI components (NavBar, HerbCard, etc.)
│       ├── hooks/           # Custom React hooks (useSearch, useAuth)
│       └── pages/           # Page components (Home, Recipes, etc.)
├── supabase/
│   ├── functions/           # Deno Edge Functions (search, recipes)
│   │   └── _shared/        # Shared utilities (CORS, embedding, types)
│   └── migrations/          # SQL migrations (herbs table, pgvector)
├── scripts/
│   └── ingest.js            # Herb data ingestion script
├── chioma_products.json     # Source herb data (134 herbs)
└── docs/                    # Architecture and changelog
```

## Tech Stack

- **Frontend:** React 19, React Router, Vite, plain CSS
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Database:** PostgreSQL with pgvector (cosine similarity search)
- **Embeddings:** OpenAI `text-embedding-3-small`
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (recipe photos)
