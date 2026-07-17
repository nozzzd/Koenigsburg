"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { DoorOpen, Loader2 } from "lucide-react";
import { leaveKoenigsburg } from "@/actions/citizenship";
import type { ActionState } from "@/lib/forms";
import { ErrorBanner } from "@/components/ui";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-800 bg-red-950/60 px-4 py-2.5 font-display text-sm font-bold tracking-wider text-red-300 transition hover:border-red-600 hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <DoorOpen className="h-4 w-4" />
      )}
      Yes — renounce my citizenship
    </button>
  );
}

export function LeaveForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    leaveKoenigsburg,
    null
  );

  return (
    <form action={action} className="space-y-3">
      {state?.error && <ErrorBanner message={state.error} />}
      <ConfirmButton />
    </form>
  );
}
