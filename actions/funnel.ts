"use server";

import { randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { getSupabase, type FunnelEventName } from "@/lib/supabase";
import { checkRateLimit, ipFromHeaders } from "@/lib/ratelimit";

const VISIT_COOKIE = "kbg_visit";
const VISIT_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

const VALID: ReadonlySet<string> = new Set<FunnelEventName>([
  "landing_view",
  "quiz_start",
  "quiz_finish",
  "quiz_share",
  "signup_view",
  "discord_click",
]);

/** Read (or mint) the anonymous per-browser visit token. */
async function visitId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VISIT_COOKIE)?.value;
  if (existing) return existing;
  const id = randomBytes(16).toString("hex");
  store.set(VISIT_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VISIT_TTL_SECONDS,
  });
  return id;
}

/**
 * Record one funnel step. Anonymous, best-effort: analytics must NEVER break a
 * page, so every failure (bad name, missing table, DB hiccup) is swallowed.
 */
export async function track(event: string): Promise<void> {
  try {
    if (!VALID.has(event)) return;
    // This is an unauthenticated write, so cap it per IP to stop the
    // funnel_events table being flooded. Real visits fire only a few events.
    const ip = ipFromHeaders(await headers());
    if (!(await checkRateLimit(`track:${ip}`, 60, 10 * 60 * 1000)).ok) return;
    const visit_id = await visitId();
    await getSupabase().from("funnel_events").insert({ event, visit_id });
  } catch {
    // swallow - never surface analytics failures to the visitor
  }
}
