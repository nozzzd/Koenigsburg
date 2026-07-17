import { cache } from "react";
import { Check, ClipboardList, Crown, Flag, X } from "lucide-react";
import { getSupabase, type Task } from "@/lib/supabase";
import { toggleTask, deleteTask } from "@/actions/tasks";
import { Panel } from "@/components/ui";
import { AddTaskForm } from "@/components/forms/AddTaskForm";

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

function TaskRow({ task, canDelete }: { task: Task; canDelete: boolean }) {
  return (
    <li className="flex items-start gap-1.5 px-4 py-2 transition hover:bg-slate-800/40">
      {/* Whole row toggles; the two controls sit side by side because a form
          can't be nested inside another form. */}
      <form action={toggleTask.bind(null, task.id)} className="min-w-0 flex-1">
        <button
          type="submit"
          className="group flex w-full items-start gap-2.5 text-left"
        >
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
              task.done
                ? "border-gold-500/60 bg-gold-400/20 text-gold-300"
                : "border-slate-700 text-transparent group-hover:border-gold-500/50"
            }`}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span
            className={`text-sm leading-snug transition ${
              task.done
                ? "text-slate-600 line-through"
                : "text-slate-300 group-hover:text-slate-100"
            }`}
          >
            {task.title}
          </span>
        </button>
      </form>
      {canDelete && (
        <form action={deleteTask.bind(null, task.id)}>
          <button
            type="submit"
            aria-label={`Remove ${task.title}`}
            className="rounded p-0.5 text-slate-700 transition hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </li>
  );
}

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: typeof Flag;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-1.5 border-y border-slate-800/80 bg-slate-950/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
      <Icon className="h-3 w-3 text-gold-500" />
      {children}
    </p>
  );
}

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
  const assigned = tasks.filter((t) => t.scope === "assigned");
  const realm = tasks.filter((t) => t.scope === "realm");
  const personal = tasks.filter((t) => t.scope === "personal");
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <Panel className={`flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-5 py-4">
        <p className="flex items-center gap-2 font-display text-xs font-bold tracking-[0.3em] text-gold-400">
          <ClipboardList className="h-4 w-4" />
          THE LEDGER
        </p>
        {openCount > 0 && (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-400">
            {openCount}
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <ClipboardList className="h-10 w-10 text-slate-700" strokeWidth={1.25} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-400">
            NOTHING SET
          </p>
          <p className="max-w-[15rem] text-sm text-slate-600">
            No duties on your slate. Add one below.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {assigned.length > 0 && (
            <>
              <SectionHeading icon={Crown}>From the council</SectionHeading>
              <ul>
                {assigned.map((task) => (
                  // Only elders may remove a duty — otherwise "assigned" would
                  // mean nothing.
                  <TaskRow key={task.id} task={task} canDelete={isAdmin} />
                ))}
              </ul>
            </>
          )}

          {realm.length > 0 && (
            <>
              <SectionHeading icon={Flag}>Goals of the realm</SectionHeading>
              <ul>
                {realm.map((task) => (
                  <TaskRow key={task.id} task={task} canDelete={isAdmin} />
                ))}
              </ul>
            </>
          )}

          {personal.length > 0 && (
            <>
              <SectionHeading icon={ClipboardList}>Your own</SectionHeading>
              <ul>
                {personal.map((task) => (
                  <TaskRow key={task.id} task={task} canDelete />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="mt-auto border-t border-slate-800/80 p-4">
        <AddTaskForm />
      </div>
    </Panel>
  );
}
