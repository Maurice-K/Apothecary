# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** Apothecary
- **Date:** 2026-10-07
- **Prepared by:** TestSprite AI Team
- **Scope:** nutritionist Edge Function after the Jev stage gate moved to TypeSafe's System One API and gained the `questions_answered` signal (`feature/jev-stage-gate`). Run: TC008–TC011 against local functions (`localhost:54321/functions/v1`, `APOTHECARY_ENV=development`, `TYPESAFE_API_KEY` set).

---

## 2️⃣ Requirement Validation Summary

### Requirement: Nutritionist stage gate (cards only in treatment)

#### Test TC008 test_nutritionist_post_with_valid_messages_streaming_response
- **Test Code:** [TC008_test_nutritionist_post_with_valid_messages_streaming_response.py](./TC008_test_nutritionist_post_with_valid_messages_streaming_response.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/ca6d66fa-833a-4f8e-8285-49009d3c4cc7
- **Status:** ✅ Passed
- **Analysis / Findings:**
  - Input: a conversation where the user has already answered the nutritionist's diagnostic questions.
  - The first SSE event was `stage {"stage":"treatment"}`.
  - The stream then had `tool_use` → `herb_results` (a non-empty herbs array) → `text_delta` → `done`, in that order.
  - Conclusion: answering the questions moves the chat to treatment, and cards are sent.
---

#### Test TC011 test_nutritionist_vague_first_message_diagnoses_without_herb_cards
- **Test Code:** [TC011_test_nutritionist_vague_first_message_diagnoses_without_herb_cards.py](./TC011_test_nutritionist_vague_first_message_diagnoses_without_herb_cards.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/34769d0e-5b16-4f35-bdcf-f2cb92dacacc
- **Status:** ✅ Passed
- **Analysis / Findings:**
  - Input: "I can't sleep".
  - The first SSE event was `stage {"stage":"diagnostic"}`.
  - There were no `tool_use` or `herb_results` events.
  - The reply text contains a question, and the stream ends with `done`.
  - Conclusion: diagnosis asks questions and shows no cards.
---

### Requirement: Nutritionist request validation

#### Test TC009 test_nutritionist_post_with_invalid_json_body
- **Test Code:** [TC009_test_nutritionist_post_with_invalid_json_body.py](./TC009_test_nutritionist_post_with_invalid_json_body.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/b71d251d-8eaa-4bab-a789-468cb1db5c56
- **Status:** ✅ Passed
- **Analysis / Findings:** Malformed JSON is rejected with 400 before the stage gate runs.
---

#### Test TC010 test_nutritionist_post_with_invalid_messages_array
- **Test Code:** [TC010_test_nutritionist_post_with_invalid_messages_array.py](./TC010_test_nutritionist_post_with_invalid_messages_array.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/b57c9086-9219-55c0-8272-62607a8acfb2/test/5dc5f4c0-1c06-466e-ae14-022a440ae0cf
- **Status:** ✅ Passed
- **Analysis / Findings:** Requests with more than 50 messages, or whose last message isn't from the user, get 400 with a validation error.
---

## 3️⃣ Coverage & Matching Metrics

- **100.00%** of tests passed

| Requirement                                       | Total Tests | ✅ Passed | ❌ Failed |
|---------------------------------------------------|-------------|-----------|-----------|
| Nutritionist stage gate (cards only in treatment) | 2           | 2         | 0         |
| Nutritionist request validation                   | 2           | 2         | 0         |
---

## 4️⃣ Key Gaps / Risks
- **Not run this time:** search tests TC001–TC004, since search was untouched. TC004 fails locally because Kong returns `*` on OPTIONS; that's not an app bug.
- **TypeSafe is a new runtime dependency:**
  - If `TYPESAFE_API_KEY` is missing, or TypeSafe errors or takes over 3 s, the stage becomes `fallback`. A first message then gets the diagnostic plan (no cards), which was checked manually with the key unset.
  - Production needs the key set as a Supabase secret before deploy.
- **Probability sensitivity:**
  - On the user's answers to the diagnostic questions, the `stage` choice alone splits about 50/50.
  - That step now uses the `questions_answered` noul instead. Answers score about 0.9, non-answers under 0.1, and the threshold is 0.7.
  - `scripts/verify_stage.js` (11 fixtures) tracks this.
- **Real model calls:** TC008 and TC011 call OpenAI and TypeSafe, so they cost a little and can vary slightly between runs.
---
