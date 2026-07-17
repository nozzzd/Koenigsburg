import "server-only";
import { getSupabase, type Player, type Team } from "./supabase";
import { addMemberRole } from "./discord";

/** Load a team by id or throw — shared by the team actions and the join core. */
export async function loadTeam(id: string): Promise<Team> {
  const { data } = await getSupabase()
    .from("teams")
    .select("*")
    .eq("id", id)
    .maybeSingle<Team>();
  if (!data) throw new Error("Team not found");
  return data;
}

/**
 * The core join: upsert membership and best-effort assign the team's Discord
 * role. NOT authorization-guarded — every caller must authorize first (the
 * admin actions run as an admin; signup runs it for the just-created player).
 * Never throws on a Discord failure: the website is the source of truth and a
 * missing role can always be added by hand.
 *
 * Lives in lib/ (not a "use server" module) so it stays an internal helper and
 * is never exposed as a callable server-action endpoint.
 */
export async function joinTeam(teamId: string, playerId: string): Promise<void> {
  if (!teamId || !playerId) throw new Error("Missing team or member");

  const supabase = getSupabase();
  const team = await loadTeam(teamId);

  const { error } = await supabase
    .from("team_members")
    .upsert(
      { team_id: teamId, player_id: playerId },
      { onConflict: "team_id,player_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(`Could not add them: ${error.message}`);

  if (team.discord_role_id) {
    const { data: player } = await supabase
      .from("players")
      .select("discord_id")
      .eq("id", playerId)
      .maybeSingle<Pick<Player, "discord_id">>();
    if (player?.discord_id) {
      try {
        await addMemberRole(player.discord_id, team.discord_role_id);
      } catch (err) {
        // Membership stands; the role can be added by hand.
        console.error("Failed to assign team Discord role:", err);
      }
    }
  }
}
