# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apothecary ("The Herbary", deployed at `herbary.app`) is a herbal wellness app. The web client has three experiences:
- **Nutritionist (`/`)** — conversational AI nutritionist powered by the OpenAI Responses API (function tools + hosted web search + SSE streaming). This is the landing page.
- **Herb Search (`/herb-search`)** — semantic search over 156 herbs (and community recipes) using OpenAI embeddings + pgvector cosine similarity.
- **Community Recipes** (`/recipe/:id`, `/my-recipes`, `/add-recipe`, `/login`, `/signup`) — Supabase Auth users create herbal recipes with photos; recipes are embedded and searchable alongside herbs.
  > **Not live yet:** login and user accounts haven't been set up for real users. The routes exist but are deliberately not linked from the nav. Ignore auth/recipe-authoring gaps (and the matching TestSprite tests tagged `[AUTH — not live]`) until accounts launch.

There is also an Expo / React Native app in `mobile/` (search, recipes, auth — no nutritionist yet) sharing the same Supabase backend.
> **Not in active development:** the mobile app is parked. Don't test, fix, or keep it in sync with web/backend changes unless asked. The web client is the only live surface.

## Architecture

```
client/ (React 19 + Vite, Vercel)  ─┐
mobile/ (Expo 54, expo-router)     ─┼─> Supabase Edge Functions (Deno) ─> OpenAI (embeddings, Responses API)
                                    │        search · recipes-search · recipes · nutritionist
                                    └─> Supabase Postgres (pgvector) + Auth + Storage (recipe-photos)
```

Four Edge Functions in `supabase/functions/`, sharing code from `_shared/`:

| Function | Purpose | Notes |
|---|---|---|
| `search` | Herb semantic search | `validateSearchRequest` → `searchHerbs()` → `match_herbs` RPC. No rate limit. |
| `recipes-search` | Herbs + recipes in one call | One embedding (no "Herb for " stem), then `match_herbs` + `match_recipes` in parallel. Uses anon-key client. Returns `{ herbs, recipes }`. |
| `recipes` | Recipe CRUD (POST / PUT / DELETE `?id=`) | Requires user JWT (`auth.getUser()`). Embeds `"${name}: ${ingredients}"`, tracks `embedding_status` (pending/complete/failed). DELETE also removes the photo from the `recipe-photos` bucket. |
| `nutritionist` | Agentic chat over SSE | See below. Rate-limited per IP. |

**Search flow:** query → `search` → `_shared/herb-search.ts` (`searchHerbs` prepends `"Herb for "`, embeds, threshold 0.3) → `match_herbs` → herb cards. The web client's `useSearch` calls **both** `search` and `recipes-search` per query (herbs from the former, recipes from the latter — two embeddings).

**Nutritionist flow** (`supabase/functions/nutritionist/index.ts`):
- Model from `_shared/openai.ts`: `OPENAI_MODEL` or `gpt-5-mini`, `reasoning.effort: "low"`, `MAX_ITERATIONS = 6`, `MAX_OUTPUT_TOKENS = 8192`. System prompt is the inline `SYSTEM_PROMPT` constant.
- Iteration 0 of the *first* user turn forces `herb_search` via `tool_choice`; later iterations use `auto` and chain with `previous_response_id`. On hitting the cap, one final turn runs with `tool_choice: "none"`.
- Tools (`_shared/tools.ts`): `herb_search` (zod-validated, `limit` default 3, max 10; results stripped of `id`/`how_to_use`/`similarity` before going back to the model) and hosted `web_search` (`search_context_size: "low"`). Tool calls run in parallel.
- SSE events (`_shared/sse.ts`): `text_delta {delta}` | `tool_use {name, input}` | `herb_results {herbs}` | `done {}` | `error {message}`.
- Client side (`useNutritionist.js`): buffers text + the **last** `herb_results` batch until `done`, drives a phase indicator (thinking → searching → researching → composing), then `ChatMessage.jsx` typewriter-renders markdown and shows herb cards after typing finishes. Text is not rendered progressively as it streams.

**Data pipeline:** Chioma's Shopify storefront (`scripts/sources.json`) → `scripts/enrich_herbs.js` (pulls tags, energetics, scientific name, plant part, origin, form) → `chioma_products.json` (156 herbs) → `scripts/ingest.js` embeds a multi-line labeled input (name → tags → category → energetics → plant_part → description) via `text-embedding-3-small` → upserts into `herbs` on `name`. High-signal labels go first so they aren't drowned by the long prose description; `how_to_use` is stored but not embedded (brewing instructions dilute signal). The query-side `"Herb for "` stem lives in `_shared/herb-search.ts` (mirrored in `scripts/verify_search.js`) — keep them in sync. See `docs/herb-catalog-pipeline.md`.

## Development Commands

```bash
# Edge Functions + Vite client together
npm run dev                       # local functions on :54321 + client on :5173

npm run functions                 # supabase functions serve --env-file .env --no-verify-jwt
npm run client                    # Vite dev server only (same as cd client && npm run dev)
npm run build                     # production client build to client/dist/
cd client && npm run lint         # ESLint (only linter in the repo)

# Data pipeline
npm run enrich                    # pull metadata from sources.json into chioma_products.json
npm run ingest                    # embed + upsert to LOCAL Supabase (default)
npm run ingest:prod               # embed + upsert to REMOTE — typed 'yes' confirmation required

# Catalog audit (no DB writes)
npm run compare                   # diff Chioma site against chioma_products.json
node scripts/verify_search.js     # query failure cases against LOCAL match_herbs
node scripts/verify_search.js prod  # query against REMOTE

# Mobile
cd mobile && npm start            # Expo dev server (also: ios / android / web)

# Deploy Edge Functions to remote (manual, intentional)
npm run deploy                    # NOTE: only deploys search + nutritionist
npx supabase functions deploy recipes recipes-search --project-ref donareoeoobqmomarisf
```

## Testing (TestSprite)

There is no unit-test suite and no CI. The web client's end-to-end tests run on **TestSprite**, a cloud AI browser agent that drives the local Vite app through a tunnel. Search-ranking changes are still verified with `verify_search.js`.

- **Project:** "Apothecary", id `84f4b903-69fa-4200-b9e6-e574d24e6edb`. Plans live in `testsprite/plans/` (see `testsprite/README.md`).
- **Active suite:** plans 01–07 (nutritionist + herb search). Tests tagged `[AUTH — not live]` are parked. Don't run them or treat their failures as bugs until accounts launch.
- **Prereqs:** `supabase start`, `npm run dev` (Vite listens on `[::1]:5173`), `testsprite` CLI authenticated (`testsprite auth status`).

**Programming loop:** after any change to `client/` or `supabase/functions/` (not docs/config), before reporting the work done:
1. Use the `testsprite-verify` skill. Pick the tests covering the change (`testsprite test list --project 84f4b903-69fa-4200-b9e6-e574d24e6edb`) and run them one per call, up to 5 in parallel:
   `testsprite test run <testId> --local 5173 --local-host ::1`
2. On failure, inspect `testsprite test steps <testId>` and the `error` field, fix the code, and re-run. Distinguish app bugs from test-setup artifacts (e.g. the agent auto-logs-in with the project's saved credentials; tunnel `ERR_INVALID_HTTP_RESPONSE` is infra, not the app).
3. For a new flow, add a plan JSON to `testsprite/plans/` and `testsprite test create --plan-from <file> --project <id>`. Steps can't be edited via CLI, so change a test by editing its plan and recreating it.
4. Credits: Free plan, 150/month; each frontend run costs 0.5. Run only the tests covering the change, not the whole suite, unless asked.

Don't edit client code while TestSprite runs are in flight (Vite HMR disturbs them). `testsprite test open <testId>` opens a test in the dashboard.

## API

**Search** (Supabase SDK):
```js
supabase.functions.invoke('search', { body: { query: "string", limit: 8 } })  // query ≤500 chars, limit 1–50
// Returns: { results: [{ id, name, description, how_to_use, category,
//   tags, energetics, botanical_name, plant_part, origin, form, similarity }] }

supabase.functions.invoke('recipes-search', { body: { query, limit } })  // → { herbs, recipes }
```

**Recipes** (Supabase SDK, requires signed-in user's JWT): `POST` create, `PUT` update, `DELETE ?id=` — see `client/src/api/recipes.js`.

**Nutritionist** (raw fetch + SSE):
```js
fetch(`${SUPABASE_URL}/functions/v1/nutritionist`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
  body: JSON.stringify({ messages: [{ role: 'user', content: '...' }] })
})
// Validation: 1–50 messages, role user|assistant, user content 1–4000 chars, last message must be user.
// 429 { error: "rate_limit", retry_after_seconds } + Retry-After when over limit.
```

## Key Files

**Backend (`supabase/functions/`)**
- `search/index.ts`, `recipes-search/index.ts`, `recipes/index.ts`, `nutritionist/index.ts` — the four functions (each has its own `deno.json`)
- `_shared/herb-search.ts` — `searchHerbs()`; owns the `"Herb for "` stem and 0.3 threshold
- `_shared/openai.ts` — OpenAI client, `MODEL`, `MAX_ITERATIONS`, `MAX_OUTPUT_TOKENS`
- `_shared/tools.ts` — `HERB_SEARCH_TOOL`, `WEB_SEARCH_TOOL`, zod schema
- `_shared/validation.ts` — request validators for search, recipes, nutritionist
- `_shared/rate-limit.ts` — IP extraction + `check_nutritionist_rate_limit` RPC; `isDevMode()`
- `_shared/cors.ts` — origin allowlist (localhost:5173, localhost:54321, `https://herbary.app`, `PUBLIC_SITE_URL`)
- `_shared/embedding.ts`, `sse.ts`, `response.ts` (`jsonResponse`/`errorResponse`), `supabase.ts` (`supabaseAdmin` service-role client), `types.ts`

**Web client (`client/src/`)**
- `App.jsx` — routes (react-router-dom 7) wrapped in `AuthProvider`
- `api/` — `search.js`, `recipes.js`, `nutritionist.js` (fetch + SSE parser), `supabaseClient.js`
- `hooks/` — `useSearch.js`, `useNutritionist.js` (chat state + phases), `useAuth.jsx`
- `pages/` — `Nutritionist.jsx`, `HomePage.jsx` (herb/recipe search tabs), recipe + auth pages
- `components/` — `Chat`, `ChatMessage` (typewriter + react-markdown), `HerbCard`, `RecipeCard`, `NavBar`, etc.

**Mobile (`mobile/`)** — expo-router screens in `app/` (`(tabs)/index`, `add-recipe`, `profile`, `login`, `signup`, `recipe/[id]`); `src/api`, `src/hooks`, `src/styles/theme.ts` mirror the web client in TypeScript.

**Data**
- `chioma_products.json` — source herb data (156 herbs)
- `scripts/sources.json` — URLs to crawl for enrichment/comparison. Add new sources here.
- `scripts/enrich_herbs.js` (idempotent), `scripts/ingest.js` (LOCAL default, `prod` with confirmation), `scripts/compare_herbs.js`, `scripts/verify_search.js`

## Supabase

Migrations in `supabase/migrations/`; apply locally with `npx supabase migration up --local`, remote with `npx supabase db push`.

- **`herbs`** — `id`, `name` (UNIQUE), `description`, `how_to_use`, `category`/`tags`/`energetics` (text[]), `botanical_name`, `plant_part`, `origin`, `form`, `embedding` vector(1536), `created_at`. ivfflat index (`lists = 10`, fine for <1000 rows), GIN on `tags`. RLS: public read.
- **`match_herbs(query_embedding, match_threshold = 0.3, match_count = 8)`** — returns all herb columns except `embedding`, plus `similarity`.
- **`recipes`** — owned by `auth.users` (`user_id`), UNIQUE(`user_id`, `name`), `embedding` with HNSW index, `embedding_status`, `updated_at` trigger. RLS: public read, author-only insert/update/delete. **`match_recipes(emb, threshold = 0.3, count = 10)`**.
- **`recipe-photos`** storage bucket — public, 5 MB, jpeg/png/webp, per-user folder policies.
- **`nutritionist_rate_limits`** + `check_nutritionist_rate_limit(client_ip, minute_limit = 5, day_limit = 30)` — SECURITY DEFINER, service_role only. Enforced unless `APOTHECARY_ENV=development`.
- **Auth** — email signup, confirmations disabled locally.

`supabase/config.toml` only declares `search` and `nutritionist` (`verify_jwt = true`); `npm run functions` serves everything with `--no-verify-jwt`.

**Remote project:** `donareoeoobqmomarisf`. Local stack at `127.0.0.1:54321` (Studio :54323) via `supabase start`.

## Deployment

- **Web client:** Vercel (`client/vercel.json` SPA rewrite). Production env in `client/.env.production`.
- **Edge Functions:** manual `npx supabase functions deploy …` (see commands above).
- **DB:** `npx supabase db push`; herb data via `npm run ingest:prod`.

## Git & Branching

- **Repo:** `https://github.com/Maurice-K/Apothecary.git`
- `main` is always deployable — never commit directly to main
- Create feature branches off `main` with naming: `feature/<short-description>`, `fix/<short-description>`, `chore/<short-description>`
- Open PRs to merge back into `main`

## Documentation

Project docs live in `docs/`. Update these after major milestones and significant additions.

- [`docs/architecture.md`](docs/architecture.md) — system design, data model, search flow, agent loop, SSE protocol
- [`docs/changelog.md`](docs/changelog.md) — chronological log of major changes and milestones
- [`docs/herb-catalog-pipeline.md`](docs/herb-catalog-pipeline.md) — enrichment/ingest pipeline details
- `docs/plans/`, `docs/tasks/`, `docs/brainstorms/` — dated feature plans and design notes

When completing a feature branch or milestone, update `docs/changelog.md`. Update `docs/architecture.md` when the system design, data model, or component structure changes.

## Environment Variables

- Root `.env` — production credentials: `OPENAI_API_KEY`, `SUPABASE_URL` (remote), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `APOTHECARY_ENV=development`. Optional: `OPENAI_MODEL` (default `gpt-5-mini`), `PUBLIC_SITE_URL` (extra CORS origin).
- Root `.env.local` — local-Supabase overrides (`SUPABASE_URL=http://127.0.0.1:54321`, local keys). Node scripts (`ingest`, `verify_search`) load this first so they target the local stack; `.env` fills in the rest (e.g. `OPENAI_API_KEY`).
- `client/.env.local` / `client/.env.production` — Vite: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `mobile/.env` — Expo app's Supabase config.

## Conventions

- Plain CSS co-located with components (no Tailwind, no CSS-in-JS)
- Edge Functions use Deno/TypeScript; web client uses plain JavaScript with JSX; mobile uses TypeScript
- Shared backend logic goes in `supabase/functions/_shared/`; functions respond via `jsonResponse`/`errorResponse` and validate via `_shared/validation.ts`
- Search uses `supabase.functions.invoke`; nutritionist uses raw `fetch` (SSE requires it)
- New Edge Functions: add to `config.toml`, the `deploy` script, and this file
- `APOTHECARY_ENV=development` bypasses rate limiting locally

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
