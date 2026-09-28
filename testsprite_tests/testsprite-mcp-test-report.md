# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** Apothecary
- **Date:** 2026-09-24
- **Prepared by:** TestSprite AI Team
- **Test Type:** Backend (Edge Functions at `http://localhost:54321/functions/v1`)

---

## 2️⃣ Requirement Validation Summary

### Requirement: Herb Semantic Search (`/search`)
- **Description:** Embedding-based herb search with request validation and CORS.

#### Test TC001 test_semantic_herb_search_with_valid_query_and_limit
- **Test Code:** [TC001_test_semantic_herb_search_with_valid_query_and_limit.py](./TC001_test_semantic_herb_search_with_valid_query_and_limit.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/878d5c4d-5791-4396-9629-e1b90bf6b73c
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Valid query returns 200 with herbs ranked by similarity (descending), every score ≥ 0.3 and the count within the limit. The "Herb for " stem, the embedding and the match_herbs path work end to end.

---

#### Test TC002 test_semantic_herb_search_with_missing_or_empty_query
- **Test Code:** [TC002_test_semantic_herb_search_with_missing_or_empty_query.py](./TC002_test_semantic_herb_search_with_missing_or_empty_query.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/77895b50-ab24-4e77-9b5d-2d1c2cd4e0cf
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Missing and empty queries are rejected with 400 by validateSearchRequest before any embedding call.

---

#### Test TC003 test_semantic_herb_search_with_invalid_limit
- **Test Code:** [TC003_test_semantic_herb_search_with_invalid_limit.py](./TC003_test_semantic_herb_search_with_invalid_limit.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/7d930cb4-2eff-46e4-a07b-3f236116c8ea
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** String limits and out-of-range limits (0, 51) are rejected with 400.

---

#### Test TC004 test_cors_preflight_on_search_endpoint
- **Test Code:** [TC004_test_cors_preflight_on_search_endpoint.py](./TC004_test_cors_preflight_on_search_endpoint.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/54741985-2aaa-4a39-b6f8-2c90bf5bae7a
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The CORS preflight from an allowed origin echoes that origin and allows POST.

---

### Requirement: Combined Herb + Recipe Search (`/recipes-search`)
- **Description:** One embedding runs match_herbs and match_recipes in parallel.

#### Test TC005 test_combined_herb_and_recipe_search_with_valid_query_and_limit
- **Test Code:** [TC005_test_combined_herb_and_recipe_search_with_valid_query_and_limit.py](./TC005_test_combined_herb_and_recipe_search_with_valid_query_and_limit.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/24a6bcdd-a2fc-45ab-9748-a0f45f33c378
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** recipes-search returns both `herbs` and `recipes` arrays from one embedding.

---

#### Test TC006 test_combined_herb_and_recipe_search_with_query_yielding_no_recipes
- **Test Code:** [TC006_test_combined_herb_and_recipe_search_with_query_yielding_no_recipes.py](./TC006_test_combined_herb_and_recipe_search_with_query_yielding_no_recipes.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/361e5615-5dd4-45c1-98c6-b823b0df9202
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** A query with no matching recipes returns an empty `recipes` array and still returns herbs.

---

#### Test TC007 test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit
- **Test Code:** [TC007_test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit.py](./TC007_test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/dfd0db3f-fc92-4ba5-89ff-d54b609be969
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** recipes-search validation rejects a missing query and an invalid limit with 400.

---

### Requirement: AI Nutritionist (`/nutritionist`)
- **Description:** Agentic chat streamed over SSE, with request validation.

#### Test TC008 test_nutritionist_post_with_valid_messages_streaming_response
- **Test Code:** [TC008_test_nutritionist_post_with_valid_messages_streaming_response.py](./TC008_test_nutritionist_post_with_valid_messages_streaming_response.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/ca6d66fa-833a-4f8e-8285-49009d3c4cc7
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The first-turn nutritionist stream returns text/event-stream and emits tool_use (the forced herb_search), herb_results, text_delta and done. This makes a real OpenAI call.

---

#### Test TC009 test_nutritionist_post_with_invalid_json_body
- **Test Code:** [TC009_test_nutritionist_post_with_invalid_json_body.py](./TC009_test_nutritionist_post_with_invalid_json_body.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/b71d251d-8eaa-4bab-a789-468cb1db5c56
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Malformed JSON returns 400 {"error":"Invalid JSON body"}.

---

#### Test TC010 test_nutritionist_post_with_invalid_messages_array
- **Test Code:** [TC010_test_nutritionist_post_with_invalid_messages_array.py](./TC010_test_nutritionist_post_with_invalid_messages_array.py)
- **Test Error:** 
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/5dc5f4c0-1c06-466e-ae14-022a440ae0cf
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** More than 50 messages, or a last message not from the user, returns 400 with a validation error.

---

## 3️⃣ Coverage & Matching Metrics

- **100%** of tests passed (10/10)

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|---|---|---|---|
| Herb Semantic Search | 4 | 4 | 0 |
| Combined Herb + Recipe Search | 3 | 3 | 0 |
| AI Nutritionist | 3 | 3 | 0 |

---

## 4️⃣ Key Gaps / Risks

- **`/recipes` CRUD not covered.** This is deliberate because accounts are not live yet. Authenticated create/update/delete, `embedding_status` transitions and photo cleanup are untested.
- **Rate limiting not exercised.** Locally `APOTHECARY_ENV=development` bypasses `check_nutritionist_rate_limit`, so the 429 + `Retry-After` path is not verified.
- **Multi-turn nutritionist not covered.** Only the first user turn is tested (forced herb_search). Later turns (`tool_choice: auto`, web_search, the MAX_ITERATIONS cap with a final `tool_choice: none` turn) and the `error` SSE event are untested.
- **CORS rejection not covered.** Only the allowed-origin preflight is tested. There is no check that a disallowed origin is refused.
- **Ranking quality is only checked structurally.** The tests check score ordering and the threshold, not relevance. Keep using `scripts/verify_search.js` for ranking changes.
- **TC008 is non-deterministic and costs money.** It makes a real OpenAI call, so model or network variance can make it flaky.

---
