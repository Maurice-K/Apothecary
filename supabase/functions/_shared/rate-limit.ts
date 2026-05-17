import { supabaseAdmin } from "./supabase.ts";

export interface RateLimitResult {
  allowed: boolean;
  minute_remaining: number;
  day_remaining: number;
  retry_after_seconds: number;
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return null;
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "check_nutritionist_rate_limit",
    { client_ip: ip },
  );
  if (error) throw error;
  // Supabase RPCs returning TABLE come back as an array of rows.
  const row = Array.isArray(data) ? data[0] : data;
  return row as RateLimitResult;
}

export function isDevMode(): boolean {
  return Deno.env.get("APOTHECARY_ENV") === "development";
}
