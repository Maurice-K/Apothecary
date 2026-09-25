
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** Apothecary
- **Date:** 2026-09-24
- **Prepared by:** TestSprite AI Team
- **Scope:** Backend. Supabase Edge Functions served locally at `http://localhost:54321/functions/v1` (`npm run functions`, `--no-verify-jwt`, rate limiting disabled via `APOTHECARY_ENV=development`). `/recipes` CRUD was excluded because accounts are not live.

---

## 2️⃣ Requirement Validation Summary

Dashboard: `https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/<test id>`

### Requirement: Herb Semantic Search (`POST /search`)
- **Description:** Embeds the query, ranks herbs with pgvector (threshold 0.3), and validates `query` (1–500 chars) and `limit` (number 1–50).

#### Test TC001 test_semantic_herb_search_with_valid_query_and_limit
- **Test Code:** [code_file](./TC001_test_semantic_herb_search_with_valid_query_and_limit.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/878d5c4d-5791-4396-9629-e1b90bf6b73c
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Returns 200. Results are sorted by similarity (descending), every similarity is ≥ 0.3, the count is ≤ limit, and each herb has the documented fields.
---

#### Test TC002 test_semantic_herb_search_with_missing_or_empty_query
- **Test Code:** [code_file](./TC002_test_semantic_herb_search_with_missing_or_empty_query.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/77895b50-ab24-4e77-9b5d-2d1c2cd4e0cf
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** A missing or empty `query` returns 400 with `query is required and must be a string`. The first run failed with "No assertions found in test code": the generated code used `raise AssertionError` instead of `assert`. This was a test-generation artifact, not an app bug. The code was regenerated with `assert` statements and passed.
---

#### Test TC003 test_semantic_herb_search_with_invalid_limit
- **Test Code:** [code_file](./TC003_test_semantic_herb_search_with_invalid_limit.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/7d930cb4-2eff-46e4-a07b-3f236116c8ea
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** `limit` values of `"5"` (string), `0` and `51` each return 400 with `limit must be a number between 1 and 50`. The first run hit the same no-assertions artifact as TC002 and passed after the code was regenerated.
---

#### Test TC004 test_cors_preflight_on_search_endpoint
- **Test Code:** [code_file](./TC004_test_cors_preflight_on_search_endpoint.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/54741985-2aaa-4a39-b6f8-2c90bf5bae7a
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** OPTIONS returns 200, echoes the allowed Origin, and the allowed methods include POST.
---

### Requirement: Combined Herb + Recipe Search (`POST /recipes-search`)
- **Description:** One embedding and parallel `match_herbs` + `match_recipes`. Returns `{ herbs, recipes }` and uses the same validation as `/search`.

#### Test TC005 test_combined_herb_and_recipe_search_with_valid_query_and_limit
- **Test Code:** [code_file](./TC005_test_combined_herb_and_recipe_search_with_valid_query_and_limit.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/24a6bcdd-a2fc-45ab-9748-a0f45f33c378
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Returns 200. Both `herbs` and `recipes` are arrays and both respect the limit.
---

#### Test TC006 test_combined_herb_and_recipe_search_with_query_yielding_no_recipes
- **Test Code:** [code_file](./TC006_test_combined_herb_and_recipe_search_with_query_yielding_no_recipes.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/361e5615-5dd4-45c1-98c6-b823b0df9202
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** When no recipes match, the response still includes an empty `recipes` array alongside the herb matches. This largely overlaps TC005.
---

#### Test TC007 test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit
- **Test Code:** [code_file](./TC007_test_combined_herb_and_recipe_search_with_missing_or_invalid_query_or_limit.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/dfd0db3f-fc92-4ba5-89ff-d54b609be969
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** A missing query or an invalid limit returns 400 with an `error` message.
---

### Requirement: AI Nutritionist Chat (`POST /nutritionist`, SSE)
- **Description:** Validates the request before any rate-limit or model call, then streams `tool_use` / `herb_results` / `text_delta` / `done` events.

#### Test TC008 test_nutritionist_post_with_valid_messages_streaming_response
- **Test Code:** [code_file](./TC008_test_nutritionist_post_with_valid_messages_streaming_response.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/ca6d66fa-833a-4f8e-8285-49009d3c4cc7
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Returns 200 with `text/event-stream`, and the stream contains the expected events through to `done`. This is the only test that makes real OpenAI calls.
---

#### Test TC009 test_nutritionist_post_with_invalid_json_body
- **Test Code:** [code_file](./TC009_test_nutritionist_post_with_invalid_json_body.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/b71d251d-8eaa-4bab-a789-468cb1db5c56
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** A body that isn't valid JSON returns 400 with `{"error":"Invalid JSON body"}`.
---

#### Test TC010 test_nutritionist_post_with_invalid_messages_array
- **Test Code:** [code_file](./TC010_test_nutritionist_post_with_invalid_messages_array.py)
- **Test Error:**
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/5dc5f4c0-1c06-466e-ae14-022a440ae0cf
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** More than 50 messages, or a last message not from the user, returns 400 with a validation error.
---

## 3️⃣ Coverage & Matching Metrics

- **100%** of tests passed (10/10) after TC002/TC003 were regenerated. On the first run, 8/10 passed.

| Requirement                          | Total Tests | ✅ Passed | ❌ Failed |
|--------------------------------------|-------------|-----------|-----------|
| Herb Semantic Search (`/search`)     | 4           | 4         | 0         |
| Combined Search (`/recipes-search`)  | 3           | 3         | 0         |
| AI Nutritionist Chat (`/nutritionist`) | 3         | 3         | 0         |

---

## 4️⃣ Key Gaps / Risks

- **Untested validation paths on `/nutritionist`:** a non-POST request (405), an invalid `role`, user content that is empty or over 4000 characters, and a non-string `content`.
- **Rate limiting (429) is not covered.** It is disabled locally (`APOTHECARY_ENV=development`), so it can only be tested against production.
- **`/search` query length limit (> 500 chars) is not explicitly asserted.**
- **Tests run against the local stack only.** They need `supabase start` + `npm run functions` and don't verify that production has the same deployed version.
- **`/recipes` CRUD is out of scope** until user accounts launch.
- **TC006 overlaps TC005.** It could be repurposed to cover one of the gaps above.
