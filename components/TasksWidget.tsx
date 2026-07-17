import { cache } from "react";
import { getSupabase, type Task } from "@/lib/supabase";
import { TaskBoard } from "@/components/TaskBoard";

/**
 * Everything on this member's slate: their own to-dos, duties an elder set for
 * them, and the realm's shared goals. Missing table (unmigrated) degrades to an
 * empty ledger rather than breaking the dashboard.
 */
const getTasks = cache(async function getTasks(playerId: string): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from("tasks")
    .select("*")
    .or(`player_id.eq.${playerId},scope.eq.realm`)
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
