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

**Login and accounts are not set up yet — ignore the auth tests for now.** Plans 08–15 (signup, login, protected routes, recipe authoring) are tagged `[AUTH — not live]` in TestSprite and aren't part of the active suite. Plan 11 expects a Log In link in the nav, which intentionally doesn't exist until accounts launch. The active suite is 01–07 (nutritionist + herb search).

The suite covers the web client only. The Expo app in `mobile/` is parked and has no tests.

The auth plans use a local-only Supabase user (`testsprite@herbary.test`), not a production account.

## Backend API (MCP)

Ten Python tests (`testsprite_tests/TC001`–`TC010`) call `search`, `recipes-search` and `nutritionist` over HTTP. They check response shapes, similarity ranking, CORS preflight, 400 validation errors and the nutritionist SSE stream. Local functions run with `--no-verify-jwt` and `APOTHECARY_ENV=development`, so no auth header is sent and rate limiting is off. `/recipes` CRUD is out of scope until accounts launch.

| Test | Endpoint | Checks |
|---|---|---|
| TC001 | `/search` | valid query → ranked herbs, similarity ≥ 0.3, ≤ limit |
| TC002 | `/search` | missing/empty `query` → 400 |
| TC003 | `/search` | `limit` of `"5"`, 0, 51 → 400 |
| TC004 | `/search` | OPTIONS preflight echoes allowed Origin |
| TC005 | `/recipes-search` | returns `{ herbs, recipes }` arrays within limit |
| TC006 | `/recipes-search` | no recipe matches → empty `recipes` array |
| TC007 | `/recipes-search` | missing query / bad limit → 400 |
| TC008 | `/nutritionist` | valid chat streams `tool_use` → `herb_results` → `text_delta` → `done` (real OpenAI call) |
| TC009 | `/nutritionist` | non-JSON body → 400 |
| TC010 | `/nutritionist` | >50 messages / last message not user → 400 |

Files:
- `testsprite_tests/TC*.py`: generated test code
- `testsprite_tests/testsprite_backend_test_plan.json`: the test plan
- `testsprite_tests/standard_prd.json`: the PRD TestSprite derived from the code summary
- `testsprite_tests/testsprite-mcp-test-report.md`: latest report
- `testsprite_tests/tmp/`: MCP config, code summary and raw report (gitignored)

**Re-running.** Ask Claude to run the backend tests with the TestSprite MCP. It calls `testsprite_generate_code_and_execute` with `testIds` (e.g. `["TC008"]`), or with no ids for all ten. Don't call `testsprite_bootstrap` again while `testsprite_tests/tmp/config.json` exists.

**Gotchas:**
- Re-running regenerates each test's `.py` file from the plan, so hand edits to `TC*.py` don't survive. To change a test, change the plan or pass `additionalInstruction`.
- TestSprite rejects test code with no `assert` statements ("No assertions found"). Generated code that signals failure with `raise AssertionError` fails for that reason. It's a codegen artifact, not an app bug; re-run the test.
- TC008 is the only test that calls OpenAI (one nutritionist turn, ~20–60 s).

**Known gaps:** 405 for non-POST, invalid `role`, empty or >4000-char user content, `/search` query > 500 chars, and 429 rate limiting (disabled locally, so only testable against production).
