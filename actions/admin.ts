"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { assignCitizenRole } from "@/lib/discord";
import { generateVerificationCode } from "@/lib/codes";

/**
 * One-click approve: pending → active/citizen, plus the Discord @Citizen role
 * when the applicant came through OAuth (Path 2). Admin-only.
 *
 * Approval also ROTATES the verification code. A manual signup posts their
 * code publicly in #immigration to prove ownership, which makes it worthless
 * as a credential — so the posted one is burned here and the member is issued
 * a fresh private login key (key_saved=false ⇒ they're warned to save it).
 */
export async function approvePlayer(playerId: string): Promise<void> {
  const admin = await getSessionPlayer();
  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    throw new Error("Not authorized");
  }

  const supabase = getSupabase();
  const { data: target } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle<Player>();
  if (!target) throw new Error("Player not found");

  if (target.status !== "active") {
    // Reroll on the (vanishingly rare) code collision.
    let updated = false;
    let lastError = "";
    for (let attempt = 0; attempt < 5 && !updated; attempt++) {
      const { error } = await supabase
        .from("players")
        .update({
          status: "active",
          role: target.role === "admin" ? "admin" : "citizen",
          verification_code: generateVerificationCode(),
          key_saved: false,
        })
        .eq("id", target.id);
      if (!error) {
        updated = true;
        break;
      }
      lastError = error.message;
      if (error.code !== "23505") break;
    }
    if (!updated) throw new Error(`Approval failed: ${lastError}`);

    if (target.discord_id) {
      try {
        await assignCitizenRole(target.discord_id);
      } catch (err) {
        // The player is approved either way; the role can be granted by hand.
        console.error(
          `Approved ${target.minecraft_ign} but Discord role assignment failed:`,
          err
        );
      }
    }
  }

  revalidatePath("/portal/admin");
  revalidatePath("/portal/admin/members");
}
