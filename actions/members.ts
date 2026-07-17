"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { removeCitizenRole } from "@/lib/discord";

async function requireAdmin(): Promise<Player> {
  const admin = await getSessionPlayer();
  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    throw new Error("Not authorized");
  }
  return admin;
}

async function loadTarget(playerId: string): Promise<Player> {
  const { data } = await getSupabase()
    .from("players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle<Player>();
  if (!data) throw new Error("Player not found");
  return data;
}

/**
 * Guards shared by every destructive action: an admin may not act on
 * themselves from the roster, and the last elder may never be removed —
 * either would lock the realm out of its own council.
 */
async function assertRemovable(admin: Player, target: Player) {
  if (admin.id === target.id) {
    throw new Error("Use the portal's own 'Leave Königsburg' control on yourself.");
  }
  if (target.role === "admin") {
    const { count } = await getSupabase()
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      throw new Error("This is the last elder of the council and cannot be removed.");
    }
  }
}

/** Best-effort strip of @Citizen — never blocks the action itself. */
async function stripDiscordRole(target: Player) {
  if (!target.discord_id) return;
  try {
    await removeCitizenRole(target.discord_id);
  } catch (err) {
    console.error(`Failed to strip @Citizen from ${target.minecraft_ign}:`, err);
  }
}

function refresh() {
  revalidatePath("/portal/admin/members");
  revalidatePath("/portal/admin");
}

/**
 * Revoke citizenship: demotes to a pending guest and strips @Citizen, but
 * keeps the record so they can be re-approved later. Reversible.
 */
export async function revokeCitizenship(playerId: string): Promise<void> {
  const admin = await requireAdmin();
  const target = await loadTarget(playerId);
  await assertRemovable(admin, target);
  await stripDiscordRole(target);

  const { error } = await getSupabase()
    .from("players")
    .update({ status: "pending", role: "guest" })
    .eq("id", target.id);
  if (error) throw new Error(`Could not revoke citizenship: ${error.message}`);
  refresh();
}

/** Kick entirely: strips @Citizen and erases the record. Irreversible. */
export async function removeMember(playerId: string): Promise<void> {
  const admin = await requireAdmin();
  const target = await loadTarget(playerId);
  await assertRemovable(admin, target);
  await stripDiscordRole(target);

  const { error } = await getSupabase().from("players").delete().eq("id", target.id);
  if (error) throw new Error(`Could not remove the member: ${error.message}`);
  refresh();
}
