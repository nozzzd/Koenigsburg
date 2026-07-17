"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, TerminalSquare } from "lucide-react";
import { registerDiscordCommands } from "@/actions/discord-commands";
import type { ResultState } from "@/lib/forms";
import { ErrorBanner } from "@/components/ui";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="pressable inline-flex items-center justify-center gap-2 rounded-lg border border-gold-500/40 px-4 py-2 text-xs font-semibold tracking-wider text-gold-300 hover:border-gold-400 hover:bg-gold-400/10 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <TerminalSquare className="h-3.5 w-3.5" />
      )}
      Register /verify command
    </button>
  );
}

export function RegisterCommandButton() {
  const [state, action] = useActionState<ResultState, FormData>(
    registerDiscordCommands,
    null
  );

  return (
    <form action={action} className="space-y-2">
      <Button />
      {state && "error" in state && <ErrorBanner message={state.error} />}
      {state && "ok" in state && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          {state.ok}
        </p>
      )}
    </form>
  );
}
