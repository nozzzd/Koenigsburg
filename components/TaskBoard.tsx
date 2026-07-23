"use client";

import { startTransition, useOptimistic, useRef, useState } from "react";
import { Check, ClipboardList, Crown, Flag, Plus, Users, X } from "lucide-react";
import type { Task } from "@/lib/supabase";
import { addPersonalTask, deleteTask, toggleTask } from "@/actions/tasks";
import { Panel } from "@/components/ui";

type Patch =
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string }
  | { type: "add"; task: Task };

function reduce(state: Task[], patch: Patch): Task[] {
  switch (patch.type) {
    case "toggle":
      return state.map((t) => (t.id === patch.id ? { ...t, done: !t.done } : t));
    case "remove":
      return state.filter((t) => t.id !== patch.id);
    case "add":
      return [...state, patch.task];
  }
}

function TaskRow({
  task,
  canDelete,
  onToggle,
  onDelete,
}: {
  task: Task;
  canDelete: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="flex items-start gap-1.5 px-4 py-2 transition hover:bg-slate-800/40">
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        className="group flex min-w-0 flex-1 items-start gap-2.5 text-left"
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
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          aria-label={`Remove ${task.title}`}
          className="rounded p-0.5 text-slate-700 transition hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
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

/**
 * Ticking a box used to wait on a database write AND a full server re-render
 * before anything moved, which felt broken. useOptimistic applies the change
 * to the list immediately and reconciles when the server answers; if the
 * action fails, React rolls the optimistic state back on its own.
 */
export function TaskBoard({
  tasks,
  playerId,
  isAdmin,
  className = "",
}: {
  tasks: Task[];
  playerId: string;
  isAdmin: boolean;
  className?: string;
}) {
  const [optimistic, patch] = useOptimistic(tasks, reduce);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onToggle(id: string) {
    startTransition(async () => {
      patch({ type: "toggle", id });
      await toggleTask(id);
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      patch({ type: "remove", id });
      await deleteTask(id);
    });
  }

  function onAdd(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (title.length < 2) {
      setError("Write out the task first.");
      return;
    }
    setError(null);
    formRef.current?.reset(); // clear the box now, not when the server answers

    startTransition(async () => {
      patch({
        type: "add",
        task: {
          id: `pending-${Date.now()}`,
          title,
          scope: "personal",
          player_id: playerId,
          team_id: null,
          assigned_by: null,
          done: false,
          created_at: new Date().toISOString(),
        },
      });
      const result = await addPersonalTask(null, formData);
      if (result?.error) setError(result.error);
    });
  }

  const assigned = optimistic.filter((t) => t.scope === "assigned");
  const team = optimistic.filter((t) => t.scope === "team");
  const realm = optimistic.filter((t) => t.scope === "realm");
  const personal = optimistic.filter((t) => t.scope === "personal");
  const openCount = optimistic.filter((t) => !t.done).length;

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

      {optimistic.length === 0 ? (
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
                  // Only elders may remove a duty - otherwise "assigned" would
                  // mean nothing.
                  <TaskRow
                    key={task.id}
                    task={task}
                    canDelete={isAdmin}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </>
          )}

          {team.length > 0 && (
            <>
              <SectionHeading icon={Users}>Your teams</SectionHeading>
              <ul>
                {team.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    canDelete={isAdmin}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </>
          )}

          {realm.length > 0 && (
            <>
              <SectionHeading icon={Flag}>Goals of the nation</SectionHeading>
              <ul>
                {realm.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    canDelete={isAdmin}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </>
          )}

          {personal.length > 0 && (
            <>
              <SectionHeading icon={ClipboardList}>Your own</SectionHeading>
              <ul>
                {personal.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    canDelete
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="mt-auto border-t border-slate-800/80 p-4">
        <form ref={formRef} action={onAdd} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              name="title"
              maxLength={200}
              autoComplete="off"
              placeholder="Add a task…"
              className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-gold-500/50"
            />
            <button
              type="submit"
              aria-label="Add task"
              className="pressable inline-flex shrink-0 items-center justify-center rounded-md border border-slate-700 px-2 py-1.5 text-slate-400 hover:border-gold-500/50 hover:text-gold-300"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      </div>
    </Panel>
  );
}
