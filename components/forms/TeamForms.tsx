"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTeam, assignTeamTask, updateTeam } from "@/actions/teams";
import type { Player, Team } from "@/lib/supabase";
import type { ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state === null) ref.current?.reset();
  }, [state]);
  return ref;
}

export function CreateTeamForm() {
  const [state, action] = useActionState<ActionState, FormData>(createTeam, null);
  const ref = useResetOnSuccess(state);

  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="team-name" className={labelClass}>
          Team name
        </label>
        <input
          id="team-name"
          name="name"
          required
          maxLength={80}
          placeholder="The Masons' Guild"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="team-desc" className={labelClass}>
          Description
        </label>
        <input
          id="team-desc"
          name="description"
          maxLength={300}
          placeholder="Keepers of stone and mortar"
          className={inputClass}
        />
      </div>
      <div className="flex items-end gap-4">
        <div>
          <label htmlFor="team-color" className={labelClass}>
            Colour
          </label>
          <input
            id="team-color"
            name="color"
            type="color"
            defaultValue="#d4af37"
            className="h-10 w-16 cursor-pointer rounded-lg border border-slate-700 bg-slate-950/60"
          />
        </div>
        <label
          htmlFor="team-role"
          className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5"
        >
          <input
            id="team-role"
            name="discord_role"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 accent-gold-400"
          />
          <span className="text-sm font-semibold text-slate-300">
            Create a matching Discord role
          </span>
        </label>
      </div>
      <SubmitButton>Found the team</SubmitButton>
    </form>
  );
}

/** Rename / re-describe / recolour an existing team. Prefilled from the team. */
export function EditTeamForm({ team }: { team: Team }) {
  const [state, action] = useActionState<ActionState, FormData>(updateTeam, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="team_id" value={team.id} />
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor={`edit-name-${team.id}`} className={labelClass}>
          Team name
        </label>
        <input
          id={`edit-name-${team.id}`}
          name="name"
          required
          maxLength={80}
          defaultValue={team.name}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`edit-desc-${team.id}`} className={labelClass}>
          Description
        </label>
        <input
          id={`edit-desc-${team.id}`}
          name="description"
          maxLength={300}
          defaultValue={team.description ?? ""}
          placeholder="Keepers of stone and mortar"
          className={inputClass}
        />
      </div>
      <div className="flex items-end gap-4">
        <div>
          <label htmlFor={`edit-color-${team.id}`} className={labelClass}>
            Colour
          </label>
          <input
            id={`edit-color-${team.id}`}
            name="color"
            type="color"
            defaultValue={team.color ?? "#d4af37"}
            className="h-10 w-16 cursor-pointer rounded-lg border border-slate-700 bg-slate-950/60"
          />
        </div>
        {team.discord_role_id && (
          <p className="flex-1 pb-1 text-xs text-slate-500">
            The linked Discord role is renamed and recoloured to match.
          </p>
        )}
      </div>
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

export function AssignTeamTaskForm({ teams }: { teams: Team[] }) {
  const [state, action] = useActionState<ActionState, FormData>(assignTeamTask, null);
  const ref = useResetOnSuccess(state);

  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="tt-team" className={labelClass}>
          Which team
        </label>
        <select id="tt-team" name="team_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose a team…
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="tt-title" className={labelClass}>
          The task
        </label>
        <input
          id="tt-title"
          name="title"
          required
          maxLength={200}
          placeholder="Clear the eastern quarry"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Appears on every team member&apos;s Ledger.
        </p>
      </div>
      <SubmitButton>Assign to the team</SubmitButton>
    </form>
  );
}
