# Changelog

All notable changes to the Apothecary project are documented here. Updated after major milestones and additions.

---

## [Unreleased]

## 2026-10-06 — Nutritionist stage gate (Jev): diagnose before recommending

- The nutritionist no longer forces `herb_search` on the first message. Each turn, `decideStage()` (new `_shared/jev.ts`) asks **Jev**, TypeSafe AI's decision model, which stage the conversation is in. Jev is called directly on TypeSafe's System One API (`api.typesafe.ai/v1/systemone`, pinned to `jev-1.13.0`) and never writes text. Code thresholds pick `diagnostic`, `treatment`, `aftercare`, `chat` or `emergency`.
- **Diagnostic** replies acknowledge the concern and ask 1–3 focused questions (duration, pattern, severity, meds/conditions), with no tools and no herbs. **Treatment** forces `herb_search`, built from everything the user told us, then runs the usual per-herb write-up and cards. `herb_search` is only offered in treatment, so the code enforces that cards wait for diagnosis.
- Users move to treatment when they answer the nutritionist's questions (a dedicated `questions_answered` question to Jev), when Jev judges the concern understood (a complete first message counts), when they ask to skip questions, or after two rounds of questions. A new concern mid-chat goes back to diagnosis.
- The system prompt is split into a shared base plus one block per stage. The old prose routing ("WHEN TO USE TOOLS") is gone, since Jev routes now.
- New SSE event `stage { stage }`, sent once before any text. The web client ignores it.
- If `TYPESAFE_API_KEY` is missing, Jev errors or returns an unexpected shape, or it takes over 3 s, the stage is `fallback`. A first message then gets the diagnostic plan, so there are no cards on a cold open. Later turns get both tools on `auto` and a prompt telling the model to diagnose first.
- New `scripts/verify_stage.js` checks the gate against 11 labeled conversations, reading only the `stage` event.
- New env vars `TYPESAFE_API_KEY` (root `.env`; Supabase secret in production) and optional `JEV_MODEL` (default `jev-1.13.0`).

## 2026-10-06 — Re-ranked herb search (Cohere Rerank)

- `searchHerbs()` now pulls 25 cosine candidates from `match_herbs` and re-ranks them with Cohere Rerank (`rerank-v4.0-fast`, new `_shared/rerank.ts`) before keeping the top `limit`. Both the herb search page and the nutritionist's `herb_search` tool get it.
- The reranker gets the raw query and the embedding keeps the `"Herb for "` stem. Compared on `verify_search.js` queries, the stem ranked slightly worse for the reranker.
- Results carry a new `relevance` score (0–1) and are ordered by it. The "% match" badge shows `relevance`, falling back to `similarity`. The nutritionist strips `relevance` before results reach the model.
- If `COHERE_API_KEY` is missing, Cohere errors, or it takes over 2 s, search returns plain cosine order without `relevance`.
- `scripts/verify_search.js` prints the cosine top-5 next to the reranked top-5.
- New env var `COHERE_API_KEY` (root `.env`; Supabase secret in production). Needs a production Cohere key, because trial keys are capped at 10 calls/minute.
- Backend test TC001 now checks ordering by `relevance` instead of `similarity`.
- TestSprite plan 05: reworded the empty-state assertion. The test agent had mistaken the site title "The Herbary" for the "Welcome to the Herbary" empty-state heading.

## 2026-09-28 — Nutritionist stream cancellation + dropped-connection handling

- "New chat" and leaving the page now abort the in-flight nutritionist request. The server passes the SSE stream's disconnect signal to OpenAI, so the agent loop stops instead of running (and billing) to completion for nobody.
- If the stream closes without a `done` or `error` event, the client now shows an error instead of leaving the chat stuck on the thinking indicator.
- Stream buffers are now scoped to each request, so a cancelled stream can't write into the next conversation.

## 2026-09-28 — Removed community recipes, accounts and the mobile app

Recipes and user accounts never launched, so they're gone rather than parked. The web client is now just the nutritionist and herb search.

**Backend**
- Deleted the `recipes` and `recipes-search` Edge Functions (locally and on `donareoeoobqmomarisf`)
- New migration `20260928181241_drop_recipes.sql` drops the `recipes` table, `match_recipes`, `update_updated_at_column()`, the `recipe-photos` bucket and its storage policies. The herbs RLS policy from the recipes migration stays. The bucket delete sets `storage.allow_delete_query` to get past `storage.protect_delete`; the objects FK still aborts it if any photos exist. `match_recipes` is dropped by name because `vector` lives in `public` on remote but `extensions` locally
- Removed the recipe validators and types from `_shared/`, and the `client` parameter from `searchHerbs` (only `recipes-search` passed one)

**Client**
- Removed login, signup, My Recipes, Add Recipe and recipe detail pages, `useAuth`/`AuthProvider`, `api/recipes.js`, `RecipeCard`/`RecipeCardList` and the NavBar account links
- Herb search makes one `search` call per query instead of two, and drops the Herbs/Recipes tabs. Results show under the "N herbs found" count, and a search with no matches shows the existing "No herbs matched" empty state. Search errors now surface instead of rendering as zero results

**Other**
- Deleted the parked Expo app in `mobile/`
- TestSprite: deleted plans 07–15 and their cloud tests (recipes tab + `[AUTH — not live]`); plans 04/05 now assert "N herbs found" and were recreated. Dropped backend tests TC005–TC007 (`recipes-search`)

## 2026-09-24 — TestSprite backend API suite

Added 10 backend tests generated by the TestSprite MCP (`testsprite_tests/TC001`–`TC010`). They call the local Edge Functions over HTTP and cover `search`, `recipes-search` and `nutritionist`: request validation, ranked result shape, CORS preflight and the SSE stream. All 10 pass. `/recipes` CRUD is out of scope until accounts launch. Also deleted the deprecated duplicate wrong-password frontend test. See `testsprite/README.md` for how to run both suites and for the known coverage gaps.

## 2026-09-24 — TestSprite E2E suite + auth navigation fixes

Seeded a TestSprite frontend suite (15 plans in `testsprite/plans/`, run against the local Vite app with a local test user `testsprite@herbary.test`) covering the nutritionist, herb search, auth, and recipe flows.

**Note:** login and accounts are not set up for real users yet, so the auth/recipe tests are parked (tagged `[AUTH — not live]`, p3) and `/login`/`/signup` intentionally stay unlinked from the nav. Revisit when accounts launch. The Expo app in `mobile/` is also parked and wasn't tested.

Small fixes made along the way:

- `MyRecipesPage` waits for the auth session to load before redirecting, so a signed-in user reloading `/my-recipes` is no longer bounced to `/login`
- `AddRecipePage` redirects with `<Navigate>` after auth loads instead of calling `navigate()` during render (which react-router ignores)

## 2026-05-17 — Nutritionist migrated to OpenAI Responses API

Consolidated the project on a single LLM provider. The nutritionist now uses OpenAI's Responses API (`gpt-5-mini`) instead of Anthropic.

- Replaced `_shared/anthropic.ts` with `_shared/openai.ts`
- Reshaped `HERB_SEARCH_TOOL` to the Responses function-tool format and swapped Anthropic-hosted `web_search_20250305` for OpenAI's hosted `web_search`
- Rewrote the nutritionist agent loop to stream `response.output_text.delta`, replay `function_call` items, and feed results back as `function_call_output` items
- SSE protocol unchanged (`text_delta`, `herb_results`, `tool_use`, `done`, `error`) — no client changes required
- Dropped `ANTHROPIC_API_KEY` from `.env` and the README

## 2026-05-12 — Conversational Herb Agent (Nutritionist)

Added an AI nutritionist accessible at `/nutritionist`. Users can have multi-turn herbal wellness conversations; the agent searches the 134-herb catalog via pgvector (`herb_search` tool), enriches results with live web search (hosted `web_search`), and streams responses as SSE.

**Backend**
- New Edge Function `supabase/functions/nutritionist/` — agentic tool-use loop, SSE streaming, capped at 6 iterations
- New shared modules: `openai.ts`, `tools.ts`, `sse.ts`, `rate-limit.ts`
- Per-IP rate limiting (5 req/min, 30 req/day) via `nutritionist_rate_limits` table and atomic `check_nutritionist_rate_limit` RPC
- Zod validation for `herb_search` tool input
- Extended `_shared/types.ts` and `_shared/validation.ts` with nutritionist message types

**Client**
- New `/nutritionist` route with `Chat`, `ChatMessage`, `ChatInput` components
- SSE parsed via raw `fetch` + `ReadableStream` reader
- Streaming cursor, inline herb cards per message, rate-limit countdown
- 5 starter prompt chips on empty state
- Mobile-responsive layout

**Infra**
- Migration `20260511_create_nutritionist_rate_limits.sql` applied to remote DB
- Function registered in `supabase/config.toml`

### Security
- Enabled Row Level Security (RLS) on the `herbs` table
- Added `"Public read access"` SELECT policy for `anon` and `authenticated` roles
- Write operations (INSERT, UPDATE, DELETE) now blocked via the Data API

### Project Setup
- Initialized project spec and CLAUDE.md
- Defined architecture: Supabase Edge Functions (Deno) + React SPA (Vite)
- Designed herbs table schema with pgvector (VECTOR(1536)), UNIQUE constraint on `name`
- Added `category` field (TEXT[]) to herbs table, match_herbs RPC, and ingestion pipeline
- Ingestion script uses upsert on `name` for idempotent re-runs
- Set up Git repo with GitHub Flow branching strategy (`main` + feature branches)
- Created project documentation (`docs/architecture.md`, `docs/changelog.md`)
