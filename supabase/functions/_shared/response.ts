import { CORS_HEADERS, getAllowedOrigin } from "./cors.ts";

export function jsonResponse<T>(req: Request, data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": getAllowedOrigin(req),
      ...CORS_HEADERS,
    },
  });
}

export function errorResponse(req: Request, err: unknown, status = 500): Response {
  const message =
    err instanceof Error ? err.message : "Internal server error";
  return jsonResponse(req, { error: message }, status);
}
