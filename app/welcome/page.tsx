import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { getDiscordHandoff, getSessionPlayer } from "@/lib/session";
import { Crest, GateShell, Panel } from "@/components/ui";
import { WelcomeForm } from "@/components/forms/WelcomeForm";

export const metadata: Metadata = { title: "Welcome, Citizen" };

/** Path 1 - @Citizen verified in Discord; one-time IGN prompt. */
export default async function WelcomePage() {
  const player = await getSessionPlayer();
  if (player) redirect(player.status === "pending" ? "/pending" : "/portal");

  const handoff = await getDiscordHandoff();
  if (!handoff) redirect("/login");
  if (!handoff.citizen) redirect("/apply");

  return (
    <GateShell>
      <div className="mb-8 flex flex-col items-center text-center">
        <Crest className="h-16 w-16" />
        <h1 className="mt-6 font-display text-2xl font-bold tracking-[0.2em] text-slate-100">
          THE GATES OPEN
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          The nation awaits you,{" "}
          <span className="font-semibold text-gold-300">@{handoff.discordUsername}</span>.
        </p>
      </div>

      <Panel className="space-y-5 p-6">
        <div className="flex items-center gap-3 rounded-lg border border-gold-500/30 bg-gold-400/5 px-4 py-2.5 text-sm">
          <BadgeCheck className="h-4 w-4 shrink-0 text-gold-400" />
          <span className="text-slate-300">
            Your <span className="font-semibold text-gold-300">@Citizen</span> role is
            confirmed. Declare your Minecraft name once to claim your citizenship.
          </span>
        </div>
        <WelcomeForm />
      </Panel>
    </GateShell>
  );
}
