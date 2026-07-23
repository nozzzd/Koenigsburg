import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSupabase, type Player } from "./supabase";
import { ensureActiveCitizenship } from "./citizenship";
import { env } from "./env";

export type SessionPlayer = Player & {
  citizenshipRevoked?: boolean;
};

const SESSION_COOKIE = "kbg_session";
const HANDOFF_COOKIE = "kbg_discord";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const HANDOFF_TTL_SECONDS = 60 * 10; // 10 minutes to finish the signup form

function sign(body: string): string {
  return createHmac("sha256", env("SESSION_SECRET")).update(body).digest("base64url");
}

function sealToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function openToken<T>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

// --- Player session -------------------------------------------------------

export async function createSession(playerId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, sealToken({ pid: playerId }, SESSION_TTL_SECONDS), {
    ...cookieOptions,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSessionPlayerId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return openToken<{ pid: string }>(token)?.pid ?? null;
}

/**
 * Resolves the session cookie to a live database row and revalidates active,
 * Discord-linked citizenship. Every caller therefore sees the role revocation,
 * including server actions and API paths outside the main portal layout.
 */
export async function getSessionPlayer(): Promise<SessionPlayer | null> {
  const playerId = await getSessionPlayerId();
  if (!playerId) return null;
  const { data } = await getSupabase()
    .from("players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle<Player>();
  if (!data) return null;
  if (data.status !== "active" || (await ensureActiveCitizenship(data))) return data;
  return {
    ...data,
    status: "pending",
    role: "guest",
    citizenshipRevoked: true,
  };
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// --- Discord OAuth handoff --------------------------------------------------
// Carries the verified Discord identity from the OAuth callback to the
// /welcome and /apply forms - signed cookie, never query params, so the
// Discord ID can't be tampered with between steps.

export interface DiscordHandoff {
  discordId: string;
  discordUsername: string;
  citizen: boolean;
}

export async function setDiscordHandoff(handoff: DiscordHandoff): Promise<void> {
  const store = await cookies();
  store.set(HANDOFF_COOKIE, sealToken({ ...handoff }, HANDOFF_TTL_SECONDS), {
    ...cookieOptions,
    maxAge: HANDOFF_TTL_SECONDS,
  });
}

export async function getDiscordHandoff(): Promise<DiscordHandoff | null> {
  const token = (await cookies()).get(HANDOFF_COOKIE)?.value;
  if (!token) return null;
  return openToken<DiscordHandoff>(token);
}

export async function clearDiscordHandoff(): Promise<void> {
  (await cookies()).delete(HANDOFF_COOKIE);
}
