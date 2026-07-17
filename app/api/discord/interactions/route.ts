import { createPublicKey, verify as cryptoVerify } from "crypto";
import { env } from "@/lib/env";
import { getSupabase, type Player } from "@/lib/supabase";
import { generateVerificationCode } from "@/lib/codes";
import { assignCitizenRole, hasCitizenRole } from "@/lib/discord";

// node:crypto — must not run on the edge runtime.
export const runtime = "nodejs";

/** DER prefix that wraps a raw 32-byte Ed25519 key as SPKI. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Discord signs every interaction. Unverified requests must be rejected with
 * 401 or Discord will refuse to register the endpoint.
 */
function signatureIsValid(signature: string, timestamp: string, rawBody: string): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.concat([
        ED25519_SPKI_PREFIX,
        Buffer.from(env("DISCORD_PUBLIC_KEY"), "hex"),
      ]),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

/** Only the invoker sees the reply — the key must never hit the channel. */
function ephemeral(content: string) {
  return Response.json({ type: 4, data: { content, flags: 64 } });
}

interface Interaction {
  type: number;
  guild_id?: string;
  data?: { name?: string; options?: { name: string; value: string }[] };
  member?: { user?: { id: string; username: string } };
  user?: { id: string; username: string };
}

async function handleVerify(interaction: Interaction) {
  const discordUser = interaction.member?.user ?? interaction.user;
  if (!discordUser) return ephemeral("Could not read your Discord account.");

  // Running in the guild proves they're actually a member of it.
  if (interaction.guild_id !== env("DISCORD_GUILD_ID")) {
    return ephemeral("Run this inside the Königsburg server.");
  }

  const code = (
    interaction.data?.options?.find((o) => o.name === "code")?.value ?? ""
  )
    .trim()
    .toUpperCase();
  if (!code) return ephemeral("Give me the code from your signup page.");

  const supabase = getSupabase();
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("verification_code", code)
    .maybeSingle<Player>();

  if (!player) {
    return ephemeral(
      "No petition carries that code. Check it on your signup page and try again."
    );
  }
  if (player.status === "active") {
    return ephemeral(`**${player.minecraft_ign}** is already a sworn citizen.`);
  }

  // This Discord account may not already belong to a different petition.
  const { data: clash } = await supabase
    .from("players")
    .select("minecraft_ign")
    .eq("discord_id", discordUser.id)
    .maybeSingle<{ minecraft_ign: string }>();
  if (clash && clash.minecraft_ign !== player.minecraft_ign) {
    return ephemeral(
      `Your Discord account is already tied to **${clash.minecraft_ign}**.`
    );
  }

  // Identity proven. Mirror the OAuth rules: an existing @Citizen is admitted
  // at once; anyone else is linked but still faces the council.
  let citizen = false;
  try {
    citizen = await hasCitizenRole(discordUser.id);
  } catch (err) {
    console.error("Role check failed during /verify:", err);
  }

  const patch: Partial<Player> = {
    discord_id: discordUser.id,
    discord_username: discordUser.username,
  };

  if (!citizen) {
    const { error } = await supabase.from("players").update(patch).eq("id", player.id);
    if (error) {
      console.error("/verify link failed:", error);
      return ephemeral("Something went wrong on our end. Try again shortly.");
    }
    return ephemeral(
      `✅ Identity confirmed — **${player.minecraft_ign}** is now tied to your Discord account.\n\n` +
        "Your petition still rests with the council. You'll receive the @Citizen role and your private key the moment an elder approves you."
    );
  }

  // Admitted: burn the signup code and issue a private login key.
  const newKey = generateVerificationCode();
  const { error } = await supabase
    .from("players")
    .update({
      ...patch,
      status: "active",
      role: "citizen",
      verification_code: newKey,
      key_saved: false,
    })
    .eq("id", player.id);
  if (error) {
    console.error("/verify approval failed:", error);
    return ephemeral("Something went wrong on our end. Try again shortly.");
  }

  try {
    await assignCitizenRole(discordUser.id);
  } catch (err) {
    console.error("Role assign failed during /verify:", err);
  }

  return ephemeral(
    `🏰 **The gates open, ${player.minecraft_ign}.**\n\n` +
      `Your private login key: \`${newKey}\`\n\n` +
      "⚠️ **Save it and never share it** — it's your only way back in if you lose your session. " +
      "Your old signup code is now dead. You can find this key again under Settings in the portal."
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  if (!signature || !timestamp || !signatureIsValid(signature, timestamp, rawBody)) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as Interaction;

  if (interaction.type === 1) return Response.json({ type: 1 }); // PING → PONG
  if (interaction.type === 2 && interaction.data?.name === "verify") {
    return handleVerify(interaction);
  }
  return ephemeral("Unknown command.");
}
