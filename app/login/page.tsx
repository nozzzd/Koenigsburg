import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, KeyRound, ScrollText } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import {
  Crest,
  ErrorBanner,
  GateShell,
  GoldDivider,
  Panel,
  outlineButtonClass,
} from "@/components/ui";
import { DiscordButton } from "@/components/DiscordButton";
import { ManualLoginForm } from "@/components/forms/ManualLoginForm";

export const metadata: Metadata = { title: "Enter the Gates" };

const OAUTH_ERRORS: Record<string, string> = {
  state: "The Discord sign-in was interrupted. Please try again.",
  discord:
    "Discord could not verify you. Try again, or return with your KBRG code below.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const player = await getSessionPlayer();
  if (player) redirect(player.status === "pending" ? "/pending" : "/portal");

  const { error } = await searchParams;
  const errorMessage = error ? OAUTH_ERRORS[error] ?? OAUTH_ERRORS.discord : null;

  return (
    <GateShell>
      <div className="mb-8 flex flex-col items-center text-center">
        <Crest className="h-16 w-16" />
        <h1 className="mt-6 font-display text-2xl font-bold tracking-[0.2em] text-slate-100">
          ENTER THE GATES
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Choose how you&apos;ll enter the realm, traveler.
        </p>
      </div>

      <Panel className="space-y-6 p-6">
        {errorMessage && <ErrorBanner message={errorMessage} />}

        {/* Two clear, equal-weight ways in */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <DiscordButton>Sign in with Discord</DiscordButton>
            <p className="text-center text-xs text-slate-500">
              Fastest way in — sworn citizens are admitted instantly.
            </p>
          </div>

          <div className="flex items-center gap-3" aria-hidden>
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">
              or
            </span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="space-y-1.5">
            <Link href="/apply" className={`${outlineButtonClass} w-full`}>
              <ScrollText className="h-4 w-4" />
              Apply for Citizenship
            </Link>
            <p className="text-center text-xs text-slate-500">
              New to the realm? Begin your petition to the council.
            </p>
          </div>
        </div>

        <GoldDivider />

        {/* Manual re-login — tucked behind a toggle for returning players */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-700 hover:text-slate-100 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gold-400" />
              Returning with a code?
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 pt-4">
            <p className="text-xs leading-relaxed text-slate-500">
              Cleared your cookies or switched devices? Enter your Minecraft name
              and the <span className="font-mono text-gold-400">KBRG-</span> code
              you were given.
            </p>
            <ManualLoginForm />
          </div>
        </details>
      </Panel>

      <p className="mt-6 text-center text-xs text-slate-600">
        Lost your KBRG code? Seek an elder in the Discord.
      </p>
    </GateShell>
  );
}
