"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { addPersonalTask } from "@/actions/tasks";
import type { ActionState } from "@/lib/forms";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Add task"
      className="pressable inline-flex shrink-0 items-center justify-center rounded-md border border-slate-700 px-2 py-1.5 text-slate-400 hover:border-gold-500/50 hover:text-gold-300 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function AddTaskForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    addPersonalTask,
    null
  );
  const ref = useRef<HTMLFormElement>(null);

  // Clear the box after a successful add so you can keep typing the next one.
  useEffect(() => {
    if (state === null) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          name="title"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Add a task…"
          className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-gold-500/50"
        />
        <AddButton />
      </div>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
