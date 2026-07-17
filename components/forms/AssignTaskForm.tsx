"use client";

import { useActionState, useEffect, useRef } from "react";
import { assignTask, addRealmGoal } from "@/actions/tasks";
import type { Player } from "@/lib/supabase";
import type { ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

/** Elder → one member. */
export function AssignTaskForm({ members }: { members: Player[] }) {
  const [state, action] = useActionState<ActionState, FormData>(assignTask, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="assign-player" className={labelClass}>
          Who it&apos;s for
        </label>
        <select
          id="assign-player"
          name="player_id"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>
            Choose a member…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.minecraft_ign} (@{m.discord_username})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="assign-title" className={labelClass}>
          The duty
        </label>
        <input
          id="assign-title"
          name="title"
          required
          maxLength={200}
          placeholder="Quarry 2 stacks of stone for the cathedral"
          className={inputClass}
        />
      </div>
      <SubmitButton>Assign the duty</SubmitButton>
    </form>
  );
}

/** Elder → the whole realm. */
export function RealmGoalForm() {
  const [state, action] = useActionState<ActionState, FormData>(addRealmGoal, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="goal-title" className={labelClass}>
          The goal
        </label>
        <input
          id="goal-title"
          name="title"
          required
          maxLength={200}
          placeholder="Raise the harbour wall before winter"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Every citizen sees this on their Ledger. Only elders can tick it off.
        </p>
      </div>
      <SubmitButton>Post the goal</SubmitButton>
    </form>
  );
}
