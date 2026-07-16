import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchDiscordUser, hasCitizenRole, type DiscordUser } from "@/lib/discord";
import { getSupabase, type Player } from "@/lib/supabase";
import { createSession, setDiscordHandoff } from "@/lib/session";

/**
 * Discord OAuth callback — decides between the three paths:
 *   existing player  → session → /portal (or /pending)
 *   has @Citizen     → Path 1 → /welcome (one-time IGN prompt)
 *   no @Citizen      → Path 2 → /apply (pre-filled application)
 */
export async function GET(request: NextRequest) {
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const store = await cookies();
  const storedState = store.get("kbg_oauth_state")?.value;
  store.delete("kbg_oauth_state");

  if (!code || !state || !storedState || state !== storedState) {
    return redirectTo("/login?error=state");
  }

  let discordUser: DiscordUser;
  try {
    const accessToken = await exchangeCode(code);
    discordUser = await fetchDiscordUser(accessToken);
  } catch (err) {
    console.error("Discord OAuth failed:", err);
    return redirectTo("/login?error=discord");
  }

  const { data: existing } = await getSupabase()
    .from("players")
    .select("*")
    .eq("discord_id", discordUser.id)
    .maybeSingle<Player>();

  if (existing) {
    await createSession(existing.id);
    return redirectTo(existing.status === "pending" ? "/pending" : "/portal");
  }

  let citizen: boolean;
  try {
    citizen = await hasCitizenRole(discordUser.id);
  } catch (err) {
    console.error("Discord guild role check failed:", err);
    return redirectTo("/login?error=discord");
  }

  await setDiscordHandoff({
    discordId: discordUser.id,
    discordUsername: discordUser.username,
    citizen,
  });

  return redirectTo(citizen ? "/welcome" : "/apply");
}
