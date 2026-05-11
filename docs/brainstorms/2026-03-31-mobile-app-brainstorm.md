---
date: 2026-03-31
topic: mobile-app
---

# Apothecary Mobile App

## What We're Building

An Expo (React Native) mobile app for iOS and Android that lives in `/mobile`. It connects to the existing Supabase backend and adds a community recipe feature.

**Two core features:**

1. **Herb Search** — Same semantic search as the web app. Users type natural language queries, get matching herb cards via OpenAI embeddings + pgvector.

2. **Community Recipes** — Users can upload and browse herbal recipes. Recipes are searchable via semantic search (same embedding approach as herbs). Anyone can browse/search; uploading requires an account.

## Recipe Structure

| Field | Type |
|-------|------|
| Name | text |
| Ingredients (herbs) | text/list |
| Instructions | text |
| Prep time | text/duration |

## Auth Model

- **Browse & search** — no account required
- **Upload recipes** — requires account (Supabase Auth)

## Key Decisions

- **Monorepo**: Mobile lives in `/mobile` alongside existing `client/` and `supabase/`
- **Shared backend**: Reuses existing Supabase project — new `recipes` table + `match_recipes` RPC + new Edge Function
- **Embedding strategy**: Embed `"<name>: <ingredients> — <instructions>"` via `text-embedding-3-small` (same model as herbs), stored as VECTOR(1536)
- **Auth provider**: Supabase Auth (email/password to start, can add social later)
- **React Native + Expo**: Targets both iOS and Android from one codebase

## Resolved Questions

- **Moderation**: No review step — recipes publish immediately
- **Web app**: Recipes available on both web and mobile
- **Images**: Recipes support photo uploads in v1 (Supabase Storage)

## Next Steps

→ `/workflows:plan` for implementation details
