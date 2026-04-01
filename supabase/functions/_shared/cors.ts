const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:54321",
];

const productionUrl = Deno.env.get("PUBLIC_SITE_URL");
if (productionUrl) {
  ALLOWED_ORIGINS.push(productionUrl);
}

export function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("Origin") ?? "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  // Fallback for non-browser clients (e.g., mobile app, curl)
  return ALLOWED_ORIGINS[0];
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...CORS_HEADERS,
        "Access-Control-Allow-Origin": getAllowedOrigin(req),
      },
    });
  }
  return null;
}
