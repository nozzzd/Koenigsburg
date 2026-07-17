"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { DoorOpen, Loader2 } from "lucide-react";
import { leaveKoenigsburg } from "@/actions/citizenship";
import type { ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-800 bg-red-950/60 px-4 py-2 text-xs font-semibold tracking-wider text-red-300 transition hover:border-red-600 hover:bg-red-900/60 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-transparent disabled:text-slate-600"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <DoorOpen className="h-3.5 w-3.5" />
      )}
      Renounce citizenship
    </button>
  );
}

/** Destructive — deliberately requires typing the exact IGN to arm the button. */
export function LeaveForm({ ign }: { ign: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    leaveKoenigsburg,
    null
  );
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === ign;

  return (
    <form action={action} className="space-y-3">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="confirm_ign" className={labelClass}>
          Type <span className="text-red-300">{ign}</span> to confirm
        </label>
        <input
          id="confirm_ign"
          name="confirm_ign"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder={ign}
          className={inputClass}
        />
      </div>
      <div className="flex justify-end">
        <ConfirmButton disabled={!matches} />
      </div>
    </form>
  );
}
