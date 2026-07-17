"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { assignCitizenRole } from "@/lib/discord";

/**
 * One-click approve: pending → active/citizen, plus the Discord @Citizen role
 * when the applicant came through OAuth (Path 2). Admin-only.
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
    const { error } = await supabase
      .from("players")
      .update({
        status: "active",
        role: target.role === "admin" ? "admin" : "citizen",
      })
      .eq("id", target.id);
    if (error) throw new Error(`Approval failed: ${error.message}`);

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
