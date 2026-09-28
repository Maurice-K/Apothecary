import type {
  NutritionistMessage,
  NutritionistRequest,
  SearchRequest,
} from "./types.ts";

export function validateSearchRequest(body: unknown): SearchRequest {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }

  const { query, limit } = body as Record<string, unknown>;

  if (!query || typeof query !== "string") {
    throw new ValidationError("query is required and must be a string");
  }

  if (query.length > 500) {
    throw new ValidationError("query must be 500 characters or less");
  }

  if (limit !== undefined && (typeof limit !== "number" || limit < 1 || limit > 50)) {
    throw new ValidationError("limit must be a number between 1 and 50");
  }

  return { query, limit: limit as number | undefined };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateNutritionistRequest(body: unknown): NutritionistRequest {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }

  const { messages } = body as Record<string, unknown>;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ValidationError("messages must be a non-empty array");
  }

  if (messages.length > 50) {
    throw new ValidationError("messages cannot exceed 50 entries");
  }

  const validated: NutritionistMessage[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      throw new ValidationError("each message must be an object");
    }
    const { role, content } = msg as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") {
      throw new ValidationError("message role must be 'user' or 'assistant'");
    }
    if (typeof content !== "string") {
      throw new ValidationError("message content must be a string");
    }
    if (role === "user" && content.length === 0) {
      throw new ValidationError("user message content must be non-empty");
    }
    if (role === "user" && content.length > 4000) {
      throw new ValidationError("user message content exceeds 4000 characters");
    }
    validated.push({ role, content });
  }

  if (validated[validated.length - 1].role !== "user") {
    throw new ValidationError("last message must have role 'user'");
  }

  return { messages: validated };
}
