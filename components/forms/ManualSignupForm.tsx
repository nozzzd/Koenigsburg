"use client";

import { useActionState } from "react";
import { manualSignup } from "@/actions/auth";
import { IGN_HINT, type ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function ManualSignupForm() {
  const [state, action] = useActionState<ActionState, FormData>(manualSignup, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="signup-ign" className={labelClass}>
          Minecraft Name
        </label>
        <input
          id="signup-ign"
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
      <div>
        <label htmlFor="signup-discord" className={labelClass}>
          Discord Username
        </label>
        <input
          id="signup-discord"
          name="discord_username"
          required
          maxLength={64}
          autoComplete="off"
          placeholder="your.discord.name"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          The council will look for you under this name in Discord.
        </p>
      </div>
      <SubmitButton>Submit Petition</SubmitButton>
    </form>
  );
}
