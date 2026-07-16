"use client";

import { useActionState } from "react";
import { manualLogin } from "@/actions/auth";
import type { ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function ManualLoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(manualLogin, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="login-ign" className={labelClass}>
          Minecraft Name
        </label>
        <input
          id="login-ign"
          name="ign"
          required
          maxLength={16}
          autoComplete="off"
          placeholder="Steve_of_Königsburg"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="login-code" className={labelClass}>
          Verification Code
        </label>
        <input
          id="login-code"
          name="code"
          required
          maxLength={20}
          autoComplete="off"
          placeholder="KBRG-XXXXXXXX"
          className={`${inputClass} font-mono tracking-widest uppercase`}
        />
      </div>
      <SubmitButton>Return with Code</SubmitButton>
    </form>
  );
}
