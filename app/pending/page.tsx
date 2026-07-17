import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hourglass, KeyRound, ShieldOff } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { logout } from "@/actions/auth";
import { Crest, GateShell, GoldDivider, Panel } from "@/components/ui";
import { CopyCode } from "@/components/CopyCode";

export const metadata: Metadata = { title: "Awaiting the Council" };

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string }>;
}) {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");
  if (player.status === "active") redirect("/portal");

  const { revoked } = await searchParams;
  const isManual = !player.discord_id;

  return (
    <GateShell>
      <div className="mb-8 flex flex-col items-center text-center">
        <Crest className="h-16 w-16" />
        <h1 className="mt-6 font-display text-2xl font-bold tracking-[0.2em] text-slate-100">
          {revoked ? "YOUR SEAT IS VACATED" : "THE COUNCIL DELIBERATES"}
        </h1>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          Petition Pending
        </div>
      </div>

      <Panel className="space-y-5 p-6">
        {revoked && (
          <div className="flex items-start gap-3 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="leading-relaxed">
              Your citizenship was revoked because you left the Königsburg Discord
              or no longer hold the{" "}
              <span className="font-semibold text-red-300">@Citizen</span> role.
              Rejoin the server and ask an elder to restore your standing.
            </p>
          </div>
        )}
        <div className="flex items-start gap-3 text-sm text-slate-300">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
          <p>
            <span className="font-semibold text-slate-100">{player.minecraft_ign}</span>,
            your petition rests before the council
            {isManual ? "" : " and they have been notified through Discord"}. The gates
            will open once an elder gives the word.
          </p>
        </div>

        <GoldDivider />

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Your Verification Code
          </p>
          <CopyCode code={player.verification_code} />
          {isManual ? (
            <p className="text-sm leading-relaxed text-slate-400">
              Copy this code and paste it into the{" "}
              <span className="font-semibold text-gold-300">#immigration</span> channel on
              our Discord to prove ownership. The council approves petitions from there.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-400">
              No further steps needed — check back soon.
            </p>
          )}
          <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs leading-relaxed text-slate-400">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
            <span>
              This code is also your <span className="text-slate-200">permanent key</span>.
              If your session is ever lost, return through the login page with your
              Minecraft name and this code. Keep it safe and secret.
            </span>
          </div>
        </div>
      </Panel>

      <form action={logout} className="mt-6 text-center">
        <button
          type="submit"
          className="text-xs text-slate-500 underline-offset-4 transition hover:text-slate-300 hover:underline"
        >
          Leave the gatehouse (log out)
        </button>
      </form>
    </GateShell>
  );
}
