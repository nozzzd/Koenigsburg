"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, type Player, type Team } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import {
  addMemberRole,
  createGuildRole,
  deleteGuildRole,
  removeMemberRole,
} from "@/lib/discord";
import type { ActionState } from "@/lib/forms";

async function requireAdmin() {
  const me = await getSessionPlayer();
  if (!me || me.role !== "admin" || me.status !== "active") {
    throw new Error("Not authorized");
  }
  return me;
}

async function loadTeam(id: string): Promise<Team> {
  const { data } = await getSupabase()
    .from("teams")
    .select("*")
    .eq("id", id)
    .maybeSingle<Team>();
  if (!data) throw new Error("Team not found");
  return data;
}

function refresh() {
  revalidatePath("/portal");
  revalidatePath("/portal/admin/teams");
}

/**
 * Create a team. If "create Discord role" is checked, mints a matching guild
 * role first. If Discord fails, the team is NOT created — the two would be out
 * of sync and confusing.
 */
export async function createTeam(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const withRole = formData.get("discord_role") === "on";

  if (name.length < 2 || name.length > 80) {
    return { error: "Give the team a name (2–80 characters)." };
  }

  let discordRoleId: string | null = null;
  if (withRole) {
    try {
      discordRoleId = await createGuildRole(name, color);
    } catch (err) {
      console.error("createGuildRole failed:", err);
      return {
        error:
          "Could not create the Discord role (check the bot's Manage Roles permission and role hierarchy). The team was not created.",
      };
    }
  }

  const { error } = await getSupabase()
    .from("teams")
    .insert({ name, description, color, discord_role_id: discordRoleId });

  if (error) {
    // Roll the Discord role back so we don't orphan it.
    if (discordRoleId) {
      try {
        await deleteGuildRole(discordRoleId);
      } catch (rollbackErr) {
        console.error("Failed to roll back orphaned Discord role:", rollbackErr);
      }
    }
    if (error.code === "23505") return { error: "A team with that name already exists." };
    console.error("createTeam failed:", error);
    return { error: "Could not create the team. Please try again." };
  }

  refresh();
  return null;
}

/** Disband a team: strips the Discord role from members, deletes the role. */
export async function deleteTeam(teamId: string): Promise<void> {
  await requireAdmin();
  const team = await loadTeam(teamId);
  const supabase = getSupabase();

  if (team.discord_role_id) {
    // Strip the role from everyone in the team before deleting it.
    const { data: rows } = await supabase
      .from("team_members")
      .select("players(discord_id)")
      .eq("team_id", team.id)
      .returns<{ players: { discord_id: string | null } | null }[]>();
    for (const row of rows ?? []) {
      const discordId = row.players?.discord_id;
      if (discordId) {
        try {
          await removeMemberRole(discordId, team.discord_role_id);
        } catch (err) {
          console.error("Failed to strip team role during disband:", err);
        }
      }
    }
    try {
      await deleteGuildRole(team.discord_role_id);
    } catch (err) {
      console.error("Failed to delete Discord role during disband:", err);
    }
  }

  // team_members and team tasks fall away via ON DELETE CASCADE.
  const { error } = await supabase.from("teams").delete().eq("id", team.id);
  if (error) throw new Error(`Could not disband the team: ${error.message}`);
  refresh();
}

/** Add a member; assigns the Discord role if the team has one. */
export async function addTeamMember(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const teamId = String(formData.get("team_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  if (!teamId || !playerId) return { error: "Choose a member to add." };

  const supabase = getSupabase();
  const team = await loadTeam(teamId);

  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, player_id: playerId });
  if (error) {
    if (error.code === "23505") return { error: "They're already on this team." };
    console.error("addTeamMember failed:", error);
    return { error: "Could not add them. Please try again." };
  }

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

  refresh();
  return null;
}

/** Remove a member; strips the Discord role if the team has one. */
export async function removeTeamMember(teamId: string, playerId: string): Promise<void> {
  await requireAdmin();
  const supabase = getSupabase();
  const team = await loadTeam(teamId);

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("player_id", playerId);
  if (error) throw new Error(`Could not remove them: ${error.message}`);

  if (team.discord_role_id) {
    const { data: player } = await supabase
      .from("players")
      .select("discord_id")
      .eq("id", playerId)
      .maybeSingle<Pick<Player, "discord_id">>();
    if (player?.discord_id) {
      try {
        await removeMemberRole(player.discord_id, team.discord_role_id);
      } catch (err) {
        console.error("Failed to strip team Discord role:", err);
      }
    }
  }

  refresh();
}

/** A duty for a whole team — lands on every member's Ledger. */
export async function assignTeamTask(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await requireAdmin();
  const teamId = String(formData.get("team_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!teamId) return { error: "Choose a team." };
  if (title.length < 2) return { error: "Write out the task first." };
  if (title.length > 200) return { error: "Keep it under 200 characters." };

  const { error } = await getSupabase().from("tasks").insert({
    title,
    scope: "team",
    team_id: teamId,
    assigned_by: me.id,
  });
  if (error) {
    console.error("assignTeamTask failed:", error);
    return { error: "Could not assign that. Please try again." };
  }
  refresh();
  return null;
}
