"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { assignCitizenRole } from "@/lib/discord";
import { joinTeam } from "@/lib/teams";
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

  // A linked Discord account (set by /verify or OAuth) is proof of ownership.
  // Without it, a manual signup is unverified — refuse, so nobody gets in on an
  // unproven claim. The queue also hides the button, but this is the real gate.
  if (!target.discord_id) {
    throw new Error(
      "This applicant hasn't verified their Discord yet. Have them run /verify with their code first."
    );
  }

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

    // Honor the team they elected from the alignment quiz, then clear it so a
    // later re-approval can't re-add them. Best-effort: a failed join never
    // undoes the approval.
    if (target.pending_team_id) {
      try {
        await joinTeam(target.pending_team_id, target.id);
      } catch (err) {
        console.error(
          `Approved ${target.minecraft_ign} but their quiz team join failed:`,
          err
        );
      }
      await supabase.from("players").update({ pending_team_id: null }).eq("id", target.id);
    }
  }

  revalidatePath("/portal/admin");
  revalidatePath("/portal/admin/members");
}
