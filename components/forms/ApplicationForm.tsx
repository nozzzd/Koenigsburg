"use client";

import { useActionState } from "react";
import { submitApplication } from "@/actions/auth";
import { IGN_HINT, type ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

/** Path 2 — Discord identity already verified server-side via the handoff cookie. */
export function ApplicationForm({ pendingTeamId }: { pendingTeamId?: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(submitApplication, null);

  return (
    <form action={action} className="space-y-4">
      {pendingTeamId && <input type="hidden" name="pending_team_id" value={pendingTeamId} />}
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="apply-ign" className={labelClass}>
          Minecraft Name
        </label>
        <input
          id="apply-ign"
          name="ign"
          required
          maxLength={16}
          pattern="[A-Za-z0-9_]{3,16}"
          title={IGN_HINT}
          autoComplete="off"
          placeholder="Steve_of_Königsburg"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-slate-500">{IGN_HINT}</p>
      </div>
      <SubmitButton>Submit Application</SubmitButton>
    </form>
  );
}
