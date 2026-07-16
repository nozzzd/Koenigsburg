import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { getDiscordHandoff, getSessionPlayer } from "@/lib/session";
import { Crest, GateShell, GoldDivider, Panel } from "@/components/ui";
import { DiscordButton } from "@/components/DiscordButton";
import { ApplicationForm } from "@/components/forms/ApplicationForm";
import { ManualSignupForm } from "@/components/forms/ManualSignupForm";

export const metadata: Metadata = { title: "Apply for Citizenship" };

export default async function ApplyPage() {
  const player = await getSessionPlayer();
  if (player) redirect(player.status === "pending" ? "/pending" : "/portal");

  const handoff = await getDiscordHandoff();
  if (handoff?.citizen) redirect("/welcome");

  return (
    <GateShell>
      <div className="mb-8 flex flex-col items-center text-center">
        <Crest className="h-16 w-16" />
        <h1 className="mt-6 font-display text-2xl font-bold tracking-[0.2em] text-slate-100">
          PETITION THE COUNCIL
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {handoff
            ? "Your Discord identity is verified. Declare your Minecraft name to file the petition."
            : "Seek entry to the free city of Königsburg."}
        </p>
      </div>

      {handoff ? (
        <Panel className="space-y-5 p-6">
          <div className="flex items-center gap-3 rounded-lg border border-indigo-500/30 bg-indigo-950/30 px-4 py-2.5 text-sm">
            <ScrollText className="h-4 w-4 shrink-0 text-indigo-400" />
            <span className="text-slate-300">
              Applying as{" "}
              <span className="font-semibold text-indigo-300">
                @{handoff.discordUsername}
              </span>
            </span>
          </div>
          <ApplicationForm />
        </Panel>
      ) : (
        <Panel className="space-y-5 p-6">
          <DiscordButton>Fastest route: Sign in with Discord</DiscordButton>

          <GoldDivider />
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
            Browser blocking OAuth? Use the manual scroll
          </p>

          <ManualSignupForm />
        </Panel>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Already sworn in?{" "}
        <Link href="/login" className="font-semibold text-gold-400 hover:text-gold-300">
          Enter the gates
        </Link>
      </p>
    </GateShell>
  );
}
