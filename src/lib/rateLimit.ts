import type { NextRequest } from "next/server";
import { getTrustedClientIpValue } from "@/lib/clientIpPolicy.mjs";

/**
 * Return the canonical client identity established by the verified direct-nginx
 * trust model. Rate-limit counters themselves are shared and atomic in Supabase;
 * no process-local bucket state remains in this module.
 */
export function getClientIp(request: NextRequest): string {
  return getTrustedClientIpValue(request.headers, "anonymous");
}
