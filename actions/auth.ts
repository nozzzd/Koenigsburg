"use server";

import { redirect } from "next/navigation";
import { getSupabase, type Player, type PlayerRole, type PlayerStatus } from "@/lib/supabase";
import { generateVerificationCode } from "@/lib/codes";
import { IGN_HINT, IGN_PATTERN, type ActionState } from "@/lib/forms";
import {
  clearDiscordHandoff,
  createSession,
  destroySession,
  getDiscordHandoff,
} from "@/lib/session";

function readIgn(formData: FormData): string | null {
  const ign = String(formData.get("ign") ?? "").trim();
  return IGN_PATTERN.test(ign) ? ign : null;
}

type InsertFields = {
  minecraft_ign: string;
  discord_username: string;
  discord_id?: string;
  status: PlayerStatus;
  role: PlayerRole;
};

type InsertResult = { player: Player } | { error: string };

async function insertPlayer(fields: InsertFields): Promise<InsertResult> {
  const supabase = getSupabase();
  // Reroll on the (vanishingly rare) verification-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("players")
      .insert({ ...fields, verification_code: generateVerificationCode() })
      .select()
      .single<Player>();
    if (data) return { player: data };
    if (error?.code === "23505") {
      if (error.message.includes("verification_code")) continue;
      if (error.message.includes("minecraft_ign")) {
        return {
          error:
            "That Minecraft name is already registered. If it is yours, return through the login page with your KBRG code.",
        };
      }
      if (error.message.includes("discord_id")) {
        return { error: "This Discord account is already registered. Try signing in instead." };
      }
    }
    console.error("players insert failed:", error);
    return { error: "Something went wrong on our end. Please try again." };
  }
  return { error: "Could not mint a unique code. Please try again." };
}

/** Path 3 — manual fallback signup (no OAuth). */
export async function manualSignup(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ign = readIgn(formData);
  if (!ign) return { error: `Enter a valid Minecraft name (${IGN_HINT}).` };
  const discordUsername = String(formData.get("discord_username") ?? "").trim();
  if (discordUsername.length < 2 || discordUsername.length > 64) {
    return { error: "Enter your Discord username so the council can find you." };
  }

  const result = await insertPlayer({
    minecraft_ign: ign,
    discord_username: discordUsername,
    status: "pending",
    role: "guest",
  });
  if ("error" in result) return result;

  await createSession(result.player.id);
  redirect("/pending");
}

/** Path 2 — application after Discord OAuth (no @Citizen role yet). */
export async function submitApplication(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const handoff = await getDiscordHandoff();
  if (!handoff) {
    return { error: "Your Discord sign-in expired. Please sign in with Discord again." };
  }
  const ign = readIgn(formData);
  if (!ign) return { error: `Enter a valid Minecraft name (${IGN_HINT}).` };

  const result = await insertPlayer({
    minecraft_ign: ign,
    discord_id: handoff.discordId,
    discord_username: handoff.discordUsername,
    status: "pending",
    role: "guest",
  });
  if ("error" in result) return result;

  await clearDiscordHandoff();
  await createSession(result.player.id);
  redirect("/pending");
}

/** Path 1 — @Citizen verified via OAuth; one-time IGN prompt completes the record. */
export async function completeCitizenSetup(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const handoff = await getDiscordHandoff();
  if (!handoff?.citizen) {
    return { error: "Your Discord sign-in expired. Please sign in with Discord again." };
  }
  const ign = readIgn(formData);
  if (!ign) return { error: `Enter a valid Minecraft name (${IGN_HINT}).` };

  const result = await insertPlayer({
    minecraft_ign: ign,
    discord_id: handoff.discordId,
    discord_username: handoff.discordUsername,
    status: "active",
    role: "citizen",
  });
  if ("error" in result) return result;

  await clearDiscordHandoff();
  await createSession(result.player.id);
  redirect("/portal");
}

/** Permanent re-login: Minecraft IGN + KBRG verification code. */
export async function manualLogin(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ign = String(formData.get("ign") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!ign || !code) {
    return { error: "Enter both your Minecraft name and your KBRG code." };
  }

  const { data: player } = await getSupabase()
    .from("players")
    .select("*")
    .eq("minecraft_ign", ign)
    .eq("verification_code", code)
    .maybeSingle<Player>();

  if (!player) {
    return { error: "No matching player found. Check your Minecraft name and code." };
  }

  await createSession(player.id);
  redirect(player.status === "pending" ? "/pending" : "/portal");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
