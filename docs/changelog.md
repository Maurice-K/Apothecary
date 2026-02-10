# Changelog

All notable changes to the Apothecary project are documented here. Updated after major milestones and additions.

---

## [Unreleased]

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
