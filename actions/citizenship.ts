"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { destroySession, getSessionPlayer } from "@/lib/session";
import { removeCitizenRole } from "@/lib/discord";
import type { ActionState } from "@/lib/forms";

/**
 * Renounce citizenship: strips the Discord @Citizen role, erases the player
 * record, and ends the session. Irreversible — they must petition anew.
 */
export async function leaveKoenigsburg(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  // Typed confirmation — enforced here, not just in the UI, so no stray click
  // (or crafted request) can erase an account.
  const confirmIgn = String(formData.get("confirm_ign") ?? "").trim();
  if (confirmIgn !== player.minecraft_ign) {
    return {
      error: `Type your Minecraft name exactly — ${player.minecraft_ign} — to confirm.`,
    };
  }

  const supabase = getSupabase();

  // Never let the last elder leave — it would lock the realm out of its own
  // approval queue with no way back in.
  if (player.role === "admin") {
    const { count } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return {
        error:
          "You are the last elder of the council. Appoint another admin before you depart.",
      };
    }
  }

  if (player.discord_id) {
    try {
      await removeCitizenRole(player.discord_id);
    } catch (err) {
      // Departure still stands; the role can be stripped by hand.
      console.error(`Failed to remove Discord role for ${player.minecraft_ign}:`, err);
    }
  }

  const { error } = await supabase.from("players").delete().eq("id", player.id);
  if (error) {
    console.error("Leave failed:", error);
    return { error: "Something went wrong on our end. Please try again." };
  }

  await destroySession();
  redirect("/");
}
