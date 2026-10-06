# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** Apothecary
- **Date:** 2026-10-06
- **Prepared by:** TestSprite AI Team
- **Scope:** Backend. Supabase Edge Functions served locally at `http://localhost:54321/functions/v1` (`npm run functions`, `--no-verify-jwt`, rate limiting disabled via `APOTHECARY_ENV=development`). Run on `feature/herb-search-rerank` after adding Cohere re-ranking to `searchHerbs`. Only the tests covering the change ran: TC001–TC004 (`/search`) and TC008 (`/nutritionist` stream). TC001's plan was updated to assert ordering by `relevance`.

---

## 2️⃣ Requirement Validation Summary

Dashboard: `https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/<test id>`

### Requirement: Herb Semantic Search (`POST /search`)
- **Description:** Embeds the query, pulls 25 pgvector candidates (threshold 0.3), re-ranks them with Cohere Rerank, and validates `query` (1–500 chars) and `limit` (number 1–50).

#### Test TC001 test_semantic_herb_search_with_valid_query_and_limit
- **Test Code:** [code_file](./TC001_test_semantic_herb_search_with_valid_query_and_limit.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/878d5c4d-5791-4396-9629-e1b90bf6b73c
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Returns 200. Every result has a numeric `relevance` in [0, 1], and results are sorted by `relevance` (descending). Every similarity is ≥ 0.3, and the count is ≤ limit. This confirms the reranker ran and its order is what the endpoint returns.
---

#### Test TC002 test_semantic_herb_search_with_missing_or_empty_query
- **Test Code:** [code_file](./TC002_test_semantic_herb_search_with_missing_or_empty_query.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/77895b50-ab24-4e77-9b5d-2d1c2cd4e0cf
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** A missing or empty `query` returns 400 with `query is required and must be a string`.
---

#### Test TC003 test_semantic_herb_search_with_invalid_limit
- **Test Code:** [code_file](./TC003_test_semantic_herb_search_with_invalid_limit.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/7d930cb4-2eff-46e4-a07b-3f236116c8ea
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Invalid `limit` values return 400 with `limit must be a number between 1 and 50`.
---

#### Test TC004 test_cors_preflight_on_search_endpoint
- **Test Code:** [code_file](./TC004_test_cors_preflight_on_search_endpoint.py)
- **Test Error:** `AssertionError: Expected Access-Control-Allow-Origin to echo 'https://herbary.app', got '*'`
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/54741985-2aaa-4a39-b6f8-2c90bf5bae7a
- **Status:** ❌ Failed
- **Severity:** LOW (environment)
- **Analysis / Findings:** This is not caused by the rerank change, which doesn't touch `_shared/cors.ts`. The local stack's API gateway (`Server: kong/2.8.1`) now answers the OPTIONS preflight itself with `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS,TRACE,CONNECT`, so the function's `handleCors` is never reached. The local Supabase Docker images were refreshed on this run, which is the likely cause. Recheck against production, or after pinning the local CLI version, before treating it as an app bug.
---

### Requirement: AI Nutritionist Chat (`POST /nutritionist`, SSE)
- **Description:** Validates the request before any rate-limit or model call, then streams `tool_use` / `herb_results` / `text_delta` / `done` events.

#### Test TC008 test_nutritionist_post_with_valid_messages_streaming_response
- **Test Code:** [code_file](./TC008_test_nutritionist_post_with_valid_messages_streaming_response.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/ca6d66fa-833a-4f8e-8285-49009d3c4cc7
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Returns 200 with `text/event-stream`, and the stream contains the expected events through to `done`. The `herb_search` tool path (shared `searchHerbs`, now re-ranked) still works. This test makes real OpenAI and Cohere calls.
---

## 3️⃣ Coverage & Matching Metrics

- **80%** of tests run passed (4/5). The one failure (TC004) is a local-gateway artifact. TC009 and TC010 (`/nutritionist` validation) were not re-run because the change doesn't touch them.

| Requirement                            | Total Tests | ✅ Passed | ❌ Failed |
|----------------------------------------|-------------|-----------|-----------|
| Herb Semantic Search (`/search`)       | 4           | 3         | 1         |
| AI Nutritionist Chat (`/nutritionist`) | 1           | 1         | 0         |

---

## 4️⃣ Key Gaps / Risks

- **No backend test covers the reranker fallback.** A missing key, a Cohere error or a timeout should return cosine order without `relevance`. This was checked by hand with an invalid key, but can't be automated against the shared local stack.
- **Local CORS preflight no longer reaches the function** (TC004), so the CORS allowlist isn't currently tested locally.
- **Untested validation paths on `/nutritionist`:** a non-POST request (405), an invalid `role`, user content that is empty or over 4000 characters, and a non-string `content`.
- **Rate limiting (429) is not covered.** It is disabled locally (`APOTHECARY_ENV=development`).
- **Tests run against the local stack only.** Production needs `COHERE_API_KEY` set as a Supabase secret and the functions redeployed.
