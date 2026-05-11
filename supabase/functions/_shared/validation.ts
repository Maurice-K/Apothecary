import type { SearchRequest, CreateRecipeRequest, UpdateRecipeRequest } from "./types.ts";

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

export function validateCreateRecipeRequest(body: unknown): CreateRecipeRequest {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }

  const { name, ingredients, instructions, prep_time } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || name.length < 3 || name.length > 200) {
    throw new ValidationError("name is required and must be 3-200 characters");
  }

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    throw new ValidationError("ingredients must be a non-empty array");
  }

  for (const item of ingredients) {
    if (typeof item !== "string" || item.length === 0 || item.length > 100) {
      throw new ValidationError("each ingredient must be a string of 1-100 characters");
    }
  }

  if (!instructions || typeof instructions !== "string" || instructions.length < 10 || instructions.length > 10000) {
    throw new ValidationError("instructions is required and must be 10-10000 characters");
  }

  if (prep_time !== undefined && prep_time !== null) {
    if (typeof prep_time !== "number" || prep_time < 1 || prep_time > 1440) {
      throw new ValidationError("prep_time must be a number between 1 and 1440 minutes");
    }
  }

  return {
    name,
    ingredients: ingredients as string[],
    instructions,
    prep_time: (prep_time as number) ?? null,
  };
}

export function validateUpdateRecipeRequest(body: unknown): UpdateRecipeRequest {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }

  const { name, ingredients, instructions, prep_time } = body as Record<string, unknown>;
  const updates: UpdateRecipeRequest = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.length < 3 || name.length > 200) {
      throw new ValidationError("name must be 3-200 characters");
    }
    updates.name = name;
  }

  if (ingredients !== undefined) {
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      throw new ValidationError("ingredients must be a non-empty array");
    }
    for (const item of ingredients) {
      if (typeof item !== "string" || item.length === 0 || item.length > 100) {
        throw new ValidationError("each ingredient must be a string of 1-100 characters");
      }
    }
    updates.ingredients = ingredients as string[];
  }

  if (instructions !== undefined) {
    if (typeof instructions !== "string" || instructions.length < 10 || instructions.length > 10000) {
      throw new ValidationError("instructions must be 10-10000 characters");
    }
    updates.instructions = instructions;
  }

  if (prep_time !== undefined) {
    if (prep_time !== null && (typeof prep_time !== "number" || prep_time < 1 || prep_time > 1440)) {
      throw new ValidationError("prep_time must be null or a number between 1 and 1440 minutes");
    }
    updates.prep_time = prep_time as number | null;
  }

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("At least one field must be provided for update");
  }

  return updates;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
