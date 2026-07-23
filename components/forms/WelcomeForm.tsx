"use client";

import { useActionState } from "react";
import { completeCitizenSetup } from "@/actions/auth";
import { IGN_HINT, type ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

/** Path 1 - citizen verified; declaring the IGN activates the account. */
export function WelcomeForm() {
  const [state, action] = useActionState<ActionState, FormData>(completeCitizenSetup, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="welcome-ign" className={labelClass}>
          Minecraft Name
        </label>
        <input
          id="welcome-ign"
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
      <SubmitButton>Claim Citizenship</SubmitButton>
    </form>
  );
}
