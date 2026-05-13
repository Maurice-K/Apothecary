# Changelog

All notable changes to the Apothecary project are documented here. Updated after major milestones and additions.

---

## [Unreleased]

## 2026-05-12 — Conversational Herb Agent (Nutritionist)

Added an AI nutritionist accessible at `/nutritionist`. Users can have multi-turn herbal wellness conversations; the agent searches the 134-herb catalog via pgvector (`herb_search` tool), enriches results with live web search (Anthropic-hosted `web_search`), and streams responses as SSE.

**Backend**
- New Edge Function `supabase/functions/nutritionist/` — agentic tool-use loop, SSE streaming, capped at 6 iterations
- New shared modules: `anthropic.ts`, `tools.ts`, `sse.ts`, `rate-limit.ts`
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
