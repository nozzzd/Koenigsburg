import { getSupabase, type Player } from "@/lib/supabase";
import { sendDirectMessage } from "@/lib/discord";
import { env } from "@/lib/env";

// node:crypto / bot fetches — keep off the edge runtime.
export const runtime = "nodejs";
// Never cache: this must actually run each time the cron fires.
export const dynamic = "force-dynamic";

/**
 * Daily nudge to finish verification.
 *
 * DMs every still-pending player who HAS a linked Discord account — i.e. they
 * ran /verify to prove ownership but the council hasn't approved them yet, OR
 * they came through OAuth and never finished. A manual signup with no
 * discord_id can't be reached (we don't know their Discord), so they're the
 * ones the reminder is really chasing toward /verify in the first place — and
 * they simply aren't DM-able until they run it.
 *
 * Triggered by Vercel Cron (see vercel.json). Vercel attaches
 * `Authorization: Bearer $CRON_SECRET`; we reject anything else so the endpoint
 * can't be hit by the public.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  let expected: string;
  try {
    expected = `Bearer ${env("CRON_SECRET")}`;
  } catch {
    // No secret configured — refuse rather than run unauthenticated.
    return new Response("cron not configured", { status: 503 });
  }
  if (auth !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data, error } = await getSupabase()
    .from("players")
    .select("*")
    .eq("status", "pending")
    .not("discord_id", "is", null)
    .returns<Player[]>();

  if (error) {
    console.error("verify-reminders: query failed:", error);
    return new Response("query failed", { status: 500 });
  }

  const targets = data ?? [];
  let sent = 0;
  for (const player of targets) {
    if (!player.discord_id) continue;
    const message =
      `🏰 **A reminder from the council of Königsburg.**\n\n` +
      `Your petition as **${player.minecraft_ign}** still awaits approval. ` +
      `If you haven't yet, run \`/verify ${player.verification_code}\` in the server to prove your claim — ` +
      `the council can only admit verified petitioners.\n\n` +
      `Once you're verified, an elder will admit you shortly. See you within the walls.`;
    try {
      if (await sendDirectMessage(player.discord_id, message)) sent++;
    } catch (err) {
      console.error(`verify-reminders: DM to ${player.minecraft_ign} failed:`, err);
    }
  }

  console.log(`verify-reminders: DMed ${sent}/${targets.length} pending petitioners.`);
  return Response.json({ pending: targets.length, sent });
}
