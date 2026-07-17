import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Crown, Database, Flag, Trash2, Users } from "lucide-react";
import { getSupabase, type Player, type Task, type Team } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { deleteTask } from "@/actions/tasks";
import { GoldDivider, Panel } from "@/components/ui";
import { AssignTaskForm, RealmGoalForm } from "@/components/forms/AssignTaskForm";
import { AssignTeamTaskForm } from "@/components/forms/TeamForms";

export const metadata: Metadata = { title: "Admin — The Ledger" };

export default async function AdminTasksPage() {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const supabase = getSupabase();
  const [{ data: taskRows, error }, { data: memberRows }, { data: teamRows }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .neq("scope", "personal") // members' own to-dos are their business
        .order("done", { ascending: true })
        .order("created_at", { ascending: false })
        .returns<Task[]>(),
      supabase
        .from("players")
        .select("*")
        .eq("status", "active")
        .order("minecraft_ign", { ascending: true })
        .returns<Player[]>(),
      // Teams may not exist yet (006 unmigrated) — tolerate the error.
      supabase.from("teams").select("*").order("name").returns<Team[]>(),
    ]);

  // The table won't exist until the migration is run — say so instead of crashing.
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold tracking-widest text-slate-100">
          The Ledger
        </h1>
        <Panel className="flex items-start gap-3 border-amber-900/50 p-6">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-amber-300">
              The tasks table doesn&apos;t exist yet.
            </p>
            <p className="text-slate-400">
              Open the Supabase SQL Editor and run{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-400">
                supabase/005_tasks.sql
              </code>{" "}
              from the repo, then reload this page.
            </p>
            <p className="text-xs text-slate-600">Details: {error.message}</p>
          </div>
        </Panel>
      </div>
    );
  }

  const tasks = taskRows ?? [];
  const members = memberRows ?? [];
  const teams = teamRows ?? [];
  const byId = new Map(members.map((m) => [m.id, m]));
  const byTeam = new Map(teams.map((t) => [t.id, t]));
  const assigned = tasks.filter((t) => t.scope === "assigned");
  const team = tasks.filter((t) => t.scope === "team");
  const realm = tasks.filter((t) => t.scope === "realm");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the Great Hall
        </Link>
        <p className="mt-4 font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          SET THE
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Ledger
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Every kind of task, from one place. Duties land on one member; team
          tasks on a whole team; goals of the realm on everyone. Members can tick
          them off but can&apos;t remove them.
        </p>
      </div>

      <GoldDivider />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <Crown className="h-4 w-4" />
            ASSIGN A DUTY
          </p>
          <div className="mt-4">
            {members.length === 0 ? (
              <p className="text-sm text-slate-500">No active members yet.</p>
            ) : (
              <AssignTaskForm members={members} />
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <Users className="h-4 w-4" />
            TEAM TASK
          </p>
          <div className="mt-4">
            {teams.length === 0 ? (
              <p className="text-sm text-slate-500">
                No teams yet.{" "}
                <Link
                  href="/portal/admin/teams"
                  className="font-semibold text-gold-400 hover:text-gold-300"
                >
                  Found one
                </Link>{" "}
                first.
              </p>
            ) : (
              <AssignTeamTaskForm teams={teams} />
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <Flag className="h-4 w-4" />
            GOAL OF THE REALM
          </p>
          <div className="mt-4">
            <RealmGoalForm />
          </div>
        </Panel>
      </div>

      <GoldDivider />

      {tasks.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <ClipboardList className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            THE LEDGER IS BARE
          </p>
          <p className="text-sm text-slate-500">
            Nothing set. Assign a duty or post a goal above.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {[...realm, ...team, ...assigned].map((task) => (
            <li key={task.id}>
              <Panel className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.scope === "realm" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-400/10 px-2 py-0.5 text-xs font-semibold text-gold-300">
                        <Flag className="h-3 w-3" />
                        Realm
                      </span>
                    ) : task.scope === "team" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-950/30 px-2 py-0.5 text-xs font-semibold text-sky-300">
                        <Users className="h-3 w-3" />
                        {byTeam.get(task.team_id ?? "")?.name ?? "Team"}
                      </span>
                    ) : (
                      <span className="rounded-full border border-indigo-500/40 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                        {byId.get(task.player_id ?? "")?.minecraft_ign ?? "Unknown"}
                      </span>
                    )}
                    {task.done && (
                      <span className="rounded-full border border-emerald-600/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                        Done
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1.5 text-sm ${
                      task.done ? "text-slate-600 line-through" : "text-slate-200"
                    }`}
                  >
                    {task.title}
                  </p>
                </div>
                <form action={deleteTask.bind(null, task.id)}>
                  <button
                    type="submit"
                    aria-label={`Remove ${task.title}`}
                    className="pressable inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-800 hover:bg-red-950/40 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </form>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
