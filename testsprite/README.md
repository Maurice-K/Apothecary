# TestSprite plans

Frontend E2E plans for the TestSprite project "Apothecary", run against the local Vite app:

```bash
testsprite test run <testId> --local 5173 --local-host ::1
```

**Login and accounts are not set up yet — ignore the auth tests for now.** Plans 08–15 (signup, login, protected routes, recipe authoring) are tagged `[AUTH — not live]` in TestSprite and aren't part of the active suite. Plan 11 expects a Log In link in the nav, which intentionally doesn't exist until accounts launch. The active suite is 01–07 (nutritionist + herb search).

The suite covers the web client only. The Expo app in `mobile/` is parked and has no tests.

The auth plans use a local-only Supabase user (`testsprite@herbary.test`), not a production account.
