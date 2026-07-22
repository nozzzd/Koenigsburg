import "server-only";

import { hasCitizenRoleCached } from "./discord";
import { getSupabase, type PlayerRole, type PlayerStatus } from "./supabase";

export type CitizenshipSubject = {
  id: string;
  discord_id: string | null;
  status: PlayerStatus;
  role: PlayerRole;
};

/**
 * Confirms that an active account still qualifies for citizenship.
 *
 * Discord-linked, non-admin accounts follow the live @Citizen role. Losing the
 * role or leaving the guild immediately denies the current request and moves
 * the database row back to pending. Discord outages fail open so a provider
 * incident cannot lock the whole nation out of the portal.
 */
export async function ensureActiveCitizenship(
  player: CitizenshipSubject
): Promise<boolean> {
  if (player.status !== "active") return false;
  if (!player.discord_id || player.role === "admin") return true;

  let hasRole: boolean;
  try {
    hasRole = await hasCitizenRoleCached(player.discord_id);
  } catch (err) {
    console.error("Discord citizenship check failed; allowing this request:", err);
    return true;
  }

  if (hasRole) return true;

  const { error } = await getSupabase()
    .from("players")
    .update({ status: "pending", role: "guest" })
    .eq("id", player.id)
    .eq("status", "active")
    .neq("role", "admin");
  if (error) {
    console.error("Automatic Discord citizenship revocation could not be persisted:", error);
  }

  return false;
}
