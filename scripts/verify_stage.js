#!/usr/bin/env node
// Checks the nutritionist's Jev stage gate against labeled conversations.
// Posts each fixture to the nutritionist function, reads only the first SSE
// `stage` event, then aborts. Closing the connection stops the server's agent
// loop, so each check costs one Jev call and little else.
//
// Use it to tune the thresholds in supabase/functions/_shared/jev.ts. Run
// `npm run functions` with TYPESAFE_API_KEY set first; without the key every
// fixture comes back "fallback".

import dotenv from "dotenv";

// `node scripts/verify_stage.js`        -> local
// `node scripts/verify_stage.js prod`   -> remote (rate-limited: 5/min)
const target = process.argv[2] === "prod" ? "prod" : "local";
if (target === "local") {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
} else {
  dotenv.config();
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
console.log(`Target: ${target.toUpperCase()} (${SUPABASE_URL})\n`);

const RECS =
  "Sorry the 3am wake-ups have been grinding you down. Here's what I'd look at.\n\n" +
  "### Chamomile\nGentle nervine that eases the racing-mind kind of wakefulness...\n\n" +
  "### Lemon Balm\nCalming and mildly sedative...\n\n" +
  "### Passionflower\nUseful when anxious thoughts keep you up...";

const FIXTURES = [
  {
    name: "vague first message",
    expect: "diagnostic",
    messages: [{ role: "user", content: "I can't sleep" }],
  },
  {
    name: "starter prompt",
    expect: "diagnostic",
    messages: [{ role: "user", content: "How do I get better sleep?" }],
  },
  {
    name: "detailed first message",
    expect: "treatment",
    messages: [{
      role: "user",
      content:
        "For the last 3 weeks I wake up around 3am most nights with racing thoughts and can't fall back " +
        "asleep for an hour or two. It's worse on work nights and I'm exhausted and foggy most days. I'm not " +
        "on any medications, not pregnant, and otherwise healthy.",
    }],
  },
  {
    name: "answered the diagnostic questions",
    expect: "treatment",
    messages: [
      { role: "user", content: "I can't sleep" },
      {
        role: "assistant",
        content:
          "That sounds exhausting. A few questions so I can point you the right way: is it trouble falling " +
          "asleep or staying asleep? How long has it been going on? And are you taking any medications?",
      },
      {
        role: "user",
        content: "Staying asleep, I wake at 3am with racing thoughts. About a month. No meds, not pregnant.",
      },
    ],
  },
  {
    name: "partly answered the questions",
    expect: "treatment",
    messages: [
      { role: "user", content: "How do I get better sleep?" },
      {
        role: "assistant",
        content:
          "Sorry you're dealing with that. A few questions first:\n- How long has this been going on, and is it " +
          "falling asleep or staying asleep?\n- Any prescription meds, sleep aids, or evening caffeine or alcohol?\n" +
          "- How much is it affecting your days?",
      },
      { role: "user", content: "Staying asleep mostly, about a month. No meds." },
    ],
  },
  {
    name: "dodges the questions",
    expect: "diagnostic",
    messages: [
      { role: "user", content: "How do I get better sleep?" },
      {
        role: "assistant",
        content:
          "Sorry you're dealing with that. A few questions first:\n- How long has this been going on, and is it " +
          "falling asleep or staying asleep?\n- Any prescription meds, sleep aids, or evening caffeine or alcohol?",
      },
      { role: "user", content: "Why do you need to know all that?" },
    ],
  },
  {
    name: "asks to skip questions",
    expect: "treatment",
    messages: [
      { role: "user", content: "I've been so bloated lately" },
      {
        role: "assistant",
        content: "Ugh, that's uncomfortable. Does it show up after particular meals, and how long has it been going on?",
      },
      { role: "user", content: "Honestly I don't know, can you just give me some herbs to try?" },
    ],
  },
  {
    name: "follow-up on shown herbs",
    expect: "aftercare",
    messages: [
      { role: "user", content: "Waking at 3am for weeks with racing thoughts, no meds." },
      { role: "assistant", content: RECS },
      { role: "user", content: "Is it ok to drink the chamomile with coffee earlier in the day?" },
    ],
  },
  {
    name: "thanks",
    expect: "chat",
    messages: [
      { role: "user", content: "Waking at 3am for weeks with racing thoughts, no meds." },
      { role: "assistant", content: RECS },
      { role: "user", content: "Thanks, this is really helpful!" },
    ],
  },
  {
    name: "pivot to a new concern",
    expect: "diagnostic",
    messages: [
      { role: "user", content: "Waking at 3am for weeks with racing thoughts, no meds." },
      { role: "assistant", content: RECS },
      { role: "user", content: "And what about headaches?" },
    ],
  },
  {
    name: "emergency",
    expect: "emergency",
    messages: [{ role: "user", content: "I have crushing chest pain going down my left arm and I can't catch my breath" }],
  },
];

async function firstStage(messages) {
  const controller = new AbortController();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/nutritionist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ messages }),
    signal: controller.signal,
  });
  if (!res.ok) return `HTTP ${res.status}: ${await res.text()}`;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return "(stream ended without a stage event)";
      buffer += decoder.decode(value, { stream: true });
      const match = buffer.match(/event: stage\ndata: (.*)\n/);
      if (match) return JSON.parse(match[1]).stage;
    }
  } finally {
    controller.abort();
  }
}

let passed = 0;
for (const f of FIXTURES) {
  const actual = await firstStage(f.messages);
  const ok = actual === f.expect;
  if (ok) passed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${f.name.padEnd(36)} expected ${f.expect.padEnd(10)} got ${actual}`);
}
console.log(`\n${passed}/${FIXTURES.length} matched`);
process.exitCode = passed === FIXTURES.length ? 0 : 1;
