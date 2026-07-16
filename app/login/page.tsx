import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionPlayer } from "@/lib/session";
import { Crest, ErrorBanner, GateShell, GoldDivider, Panel } from "@/components/ui";
import { DiscordButton } from "@/components/DiscordButton";
import { ManualLoginForm } from "@/components/forms/ManualLoginForm";

export const metadata: Metadata = { title: "Enter the Gates" };

const OAUTH_ERRORS: Record<string, string> = {
  state: "The Discord sign-in was interrupted. Please try again.",
  discord: "Discord could not verify you. Try again, or return with your KBRG code below.",
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
          Present yourself to the watch, traveler.
        </p>
      </div>

      <Panel className="space-y-5 p-6">
        {errorMessage && <ErrorBanner message={errorMessage} />}

        <DiscordButton>Sign in with Discord</DiscordButton>

        <GoldDivider />
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
          Or return with your code
        </p>

        <ManualLoginForm />
      </Panel>

      <p className="mt-6 text-center text-sm text-slate-500">
        New to the realm?{" "}
        <Link href="/apply" className="font-semibold text-gold-400 hover:text-gold-300">
          Apply for citizenship
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-600">
        Lost your KBRG code? Seek an elder in the Discord.
      </p>
    </GateShell>
  );
}
