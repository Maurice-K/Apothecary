import { z } from "npm:zod";
import type { NutritionistMessage } from "./types.ts";

const apiKey = Deno.env.get("TYPESAFE_API_KEY");
if (!apiKey) {
  console.warn("[jev] TYPESAFE_API_KEY is not set; nutritionist stages fall back to prompt-only routing");
}

// Jev, TypeSafe AI's decision model, through TypeSafe's System One API. It
// answers typed questions with probabilities and never writes text. Pinned to
// a version because the thresholds below are tuned against it; set
// JEV_MODEL=jev-latest to float.
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = Deno.env.get("JEV_MODEL") ?? "jev-1.13.0";
const JEV_TIMEOUT_MS = 3000;

// Recent context is all the stage call needs. 12 messages × 2,000 chars stays
// well under Jev's 32K-token state budget (validation allows 50 × 4,000).
const STATE_MESSAGES = 12;
const STATE_CHARS = 2000;

// Code, not the model, decides how sure Jev must be. Tune with
// scripts/verify_stage.js.
const EMERGENCY_MIN = 0.3; // low on purpose: safety first
// Below this, keep diagnosing. Jev rates a complete first message ~0.55–0.65
// for treatment, so 0.6 split identical messages between cards and questions.
const TREATMENT_MIN = 0.5;
const SKIP_MIN = 0.7;
const PROBED_MIN = 0.8;
// Answers to the diagnostic questions score ~0.9, everything else <0.1. A
// steadier signal for diagnosis → treatment than the stage choice, which
// splits ~50/50 there.
const ANSWERED_MIN = 0.7;

const JEV_STAGES = ["diagnostic", "treatment", "aftercare", "chat", "emergency"] as const;
type JevStage = typeof JEV_STAGES[number];

// "fallback" means Jev wasn't reachable and the model routes itself.
export type Stage = JevStage | "fallback";

const QUESTIONS = {
  stage: {
    type: "choice",
    instructions:
      "This is a chat between a user and an herbal nutritionist (the assistant). " +
      "Given the user's latest message, which stage is the conversation in?",
    criteria: {
      diagnostic:
        "The user has raised a wellness concern that the assistant doesn't yet understand well enough to " +
        "recommend herbs: what exactly it is, how long it's been going on, when or how it shows up, how " +
        "severe it is, or relevant medications, conditions or pregnancy are still unclear.",
      treatment:
        "The user's current concern is understood well enough to recommend herbs: between their messages " +
        "and their answers to the assistant's questions, they've described it in enough detail. This can be " +
        "the user's very first message if it already gives that detail.",
      aftercare:
        "The user is following up on herbs the assistant already recommended in this conversation: " +
        "safety, interactions, dosing, timing, preparation, or food.",
      chat:
        "Thanks, small talk, or a question that isn't a personal wellness concern and isn't about herbs " +
        "already recommended.",
      emergency:
        "The user describes symptoms that need urgent care: chest pain, trouble breathing, suicidal " +
        "thoughts, signs of a stroke, severe bleeding, a severe allergic reaction, or similar.",
    },
  },
  skip_requested: {
    type: "noul",
    instructions:
      "In their latest message, does the user explicitly ask to skip the questions and get herb " +
      "recommendations now?",
  },
  already_probed: {
    type: "noul",
    instructions:
      "Has the assistant already asked the user clarifying questions about their current concern in at " +
      "least two separate replies?",
  },
  questions_answered: {
    type: "noul",
    instructions:
      "The assistant asked the user clarifying questions about their current wellness concern, and in their " +
      "latest message the user answers most of those questions.",
  },
};

// The System One response shape for our three questions. Anything that
// doesn't match falls back rather than guessing.
const NoulAnswer = z.object({ type: z.literal("noul"), noul: z.number() });
const DecisionSchema = z.object({
  answers: z.object({
    stage: z.object({
      type: z.literal("choice"),
      choice: z.enum(JEV_STAGES),
      probabilities: z.record(z.string(), z.number()),
    }),
    skip_requested: NoulAnswer,
    already_probed: NoulAnswer,
    questions_answered: NoulAnswer,
  }),
});

export type StageAnswers = z.infer<typeof DecisionSchema>["answers"];

export interface StageDecision {
  stage: Stage;
  answers?: StageAnswers;
}

function resolveStage(answers: StageAnswers): JevStage {
  const p = (stage: JevStage) => answers.stage.probabilities[stage] ?? 0;
  if (p("emergency") >= EMERGENCY_MIN) return "emergency";

  switch (answers.stage.choice) {
    case "treatment":
    case "diagnostic":
      // Recommend once Jev is sure enough or the user has answered our
      // questions. Don't hold users in Q&A: an explicit "just tell me" or two
      // rounds of questions already asked is also enough to move on.
      return p("treatment") >= TREATMENT_MIN ||
          answers.questions_answered.noul >= ANSWERED_MIN ||
          answers.skip_requested.noul >= SKIP_MIN ||
          answers.already_probed.noul >= PROBED_MIN
        ? "treatment"
        : "diagnostic";
    default:
      return answers.stage.choice;
  }
}

// Asks Jev which stage the conversation is in. Any failure (no key, HTTP
// error, bad shape, timeout) returns "fallback" so the chat keeps working;
// a client disconnect still throws so the agent loop stops.
export async function decideStage(
  messages: NutritionistMessage[],
  signal: AbortSignal,
): Promise<StageDecision> {
  if (!apiKey) return { stage: "fallback" };

  const conversation = messages.slice(-STATE_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content.slice(0, STATE_CHARS),
  }));

  try {
    const res = await fetch(TYPESAFE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: JEV_MODEL,
        state: { conversation },
        questions: QUESTIONS,
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(JEV_TIMEOUT_MS)]),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

    const { answers } = DecisionSchema.parse(await res.json());
    return { stage: resolveStage(answers), answers };
  } catch (err) {
    if (signal.aborted) throw err;
    console.warn("[jev] falling back to prompt-only routing:", err instanceof Error ? err.message : err);
    return { stage: "fallback" };
  }
}
