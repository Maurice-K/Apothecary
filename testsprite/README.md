# TestSprite tests

Two suites, driven by two different TestSprite tools:

| Suite | Tool | Covers | Lives in |
|---|---|---|---|
| Frontend E2E | `testsprite` CLI | Web client (Vite on `[::1]:5173`) | `testsprite/plans/` → project "Apothecary" |
| Backend API | TestSprite MCP | Edge Functions (`localhost:54321/functions/v1`) | `testsprite_tests/` → MCP dashboard |

Prereqs for both: `supabase start` and `npm run dev` (functions on :54321, Vite on :5173).

## Frontend E2E (CLI)

Plans live in `testsprite/plans/`. Run one test per call against the local Vite app:

```bash
testsprite test run <testId> --local 5173 --local-host ::1
```

The suite is plans 01–06: nutritionist (01–03) and herb search (04–06).

## Backend API (MCP)

Seven Python tests (`testsprite_tests/TC001`–`TC004`, `TC008`–`TC010`) call `search` and `nutritionist` over HTTP. They check response shapes, similarity ranking, CORS preflight, 400 validation errors and the nutritionist SSE stream. Local functions run with `--no-verify-jwt` and `APOTHECARY_ENV=development`, so no auth header is sent and rate limiting is off. TC005–TC007 covered the removed `recipes-search` function; the remaining IDs weren't renumbered.

| Test | Endpoint | Checks |
|---|---|---|
| TC001 | `/search` | valid query → ranked herbs, similarity ≥ 0.3, ≤ limit |
| TC002 | `/search` | missing/empty `query` → 400 |
| TC003 | `/search` | `limit` of `"5"`, 0, 51 → 400 |
| TC004 | `/search` | OPTIONS preflight echoes allowed Origin |
| TC008 | `/nutritionist` | valid chat streams `tool_use` → `herb_results` → `text_delta` → `done` (real OpenAI call) |
| TC009 | `/nutritionist` | non-JSON body → 400 |
| TC010 | `/nutritionist` | >50 messages / last message not user → 400 |

Files:
- `testsprite_tests/TC*.py`: generated test code
- `testsprite_tests/testsprite_backend_test_plan.json`: the test plan
- `testsprite_tests/standard_prd.json`: the PRD TestSprite derived from the code summary
- `testsprite_tests/testsprite-mcp-test-report.md`: latest report
- `testsprite_tests/tmp/`: MCP config, code summary and raw report (gitignored)

**Re-running.** Ask Claude to run the backend tests with the TestSprite MCP. It calls `testsprite_generate_code_and_execute` with `testIds` (e.g. `["TC008"]`), or with no ids for all seven. Don't call `testsprite_bootstrap` again while `testsprite_tests/tmp/config.json` exists.

**Gotchas:**
- Re-running regenerates each test's `.py` file from the plan, so hand edits to `TC*.py` don't survive. To change a test, change the plan or pass `additionalInstruction`.
- TestSprite rejects test code with no `assert` statements ("No assertions found"). Generated code that signals failure with `raise AssertionError` fails for that reason. It's a codegen artifact, not an app bug; re-run the test.
- TC008 is the only test that calls OpenAI (one nutritionist turn, ~20–60 s).

**Known gaps:** 405 for non-POST, invalid `role`, empty or >4000-char user content, `/search` query > 500 chars, and 429 rate limiting (disabled locally, so only testable against production).
