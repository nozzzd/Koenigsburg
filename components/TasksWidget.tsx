import { cache } from "react";
import { getSupabase, type Task } from "@/lib/supabase";
import { TaskBoard } from "@/components/TaskBoard";

/**
 * Everything on this member's slate: their own to-dos, duties an elder set for
 * them, and the realm's shared goals. Missing table (unmigrated) degrades to an
 * empty ledger rather than breaking the dashboard.
 */
const getTasks = cache(async function getTasks(playerId: string): Promise<Task[]> {
  const supabase = getSupabase();

  // The teams this player belongs to - their team tasks show on the Ledger too.
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("player_id", playerId);
  const teamIds = (memberships ?? []).map((m) => m.team_id as string);

  // player's own + assigned + realm goals + tasks for any of their teams
  const filters = [`player_id.eq.${playerId}`, "scope.eq.realm"];
  if (teamIds.length > 0) {
    filters.push(`team_id.in.(${teamIds.join(",")})`);
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .or(filters.join(","))
    .order("done", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Task[]>();
  if (error) {
    console.error("Failed to load tasks:", error);
    return [];
  }
  return data ?? [];
});

export async function TasksWidget({
  playerId,
  isAdmin,
  className = "",
}: {
  playerId: string;
  isAdmin: boolean;
  className?: string;
}) {
  const tasks = await getTasks(playerId);
  return (
    <TaskBoard
      tasks={tasks}
      playerId={playerId}
      isAdmin={isAdmin}
      className={className}
    />
  );
}
