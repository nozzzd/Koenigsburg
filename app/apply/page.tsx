import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText, Shield } from "lucide-react";
import { getDiscordHandoff, getSessionPlayer } from "@/lib/session";
import { getSupabase, type Team } from "@/lib/supabase";
import { resolveRoleTeam } from "@/actions/quiz";
import { ARCHETYPE_BY_KEY } from "@/lib/quiz";
import { Crest, GateShell, GoldDivider, Panel } from "@/components/ui";
import { DiscordButton, JoinDiscordButton } from "@/components/DiscordButton";
import { ApplicationForm } from "@/components/forms/ApplicationForm";
import { ManualSignupForm } from "@/components/forms/ManualSignupForm";

export const metadata: Metadata = { title: "Apply for Citizenship" };

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const player = await getSessionPlayer();
  if (player) redirect(player.status === "pending" ? "/pending" : "/portal");

  const handoff = await getDiscordHandoff();
  if (handoff?.citizen) redirect("/welcome");

  // Quiz handoff: if ?role= maps to a real team, offer to pre-join it. The key
  // resolves to a team_id server-side, so a tampered URL can only ever name an
  // archetype we recognise — never an arbitrary team.
  const { role } = await searchParams;
  const teamId = role ? await resolveRoleTeam(role) : null;
  let electedTeam: Team | null = null;
  if (teamId) {
    const { data } = await getSupabase()
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .maybeSingle<Team>();
    electedTeam = data ?? null;
  }
  const roleLabel = role ? ARCHETYPE_BY_KEY[role as keyof typeof ARCHETYPE_BY_KEY]?.label : null;

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
            : "Seek admission to the free city of Königsburg."}
        </p>
      </div>

      {electedTeam && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-gold-500/30 bg-gold-400/5 px-4 py-3 text-sm">
          <Shield className="h-4 w-4 shrink-0 text-gold-400" />
          <span className="text-slate-300">
            {roleLabel ? `Your alignment: ${roleLabel}. ` : ""}You&apos;ll join the{" "}
            <span className="font-semibold text-gold-300">{electedTeam.name}</span> once the council
            approves you.
          </span>
        </div>
      )}

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
          <ApplicationForm pendingTeamId={electedTeam?.id ?? null} />
        </Panel>
      ) : (
        <Panel className="space-y-5 p-6">
          <div className="flex items-start gap-3 rounded-lg border border-gold-500/30 bg-gold-400/5 px-4 py-3 text-sm">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
            <p className="leading-relaxed text-slate-300">
              You must be a member of our Discord to be admitted. Signing in with Discord below is
              the fastest route. If you sign up manually, you&apos;ll still need to join the server
              and run{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-300">
                /verify
              </code>{" "}
              with your code — the council can only approve verified petitioners.
            </p>
          </div>

          <DiscordButton>Fastest route: Sign in with Discord</DiscordButton>
          <JoinDiscordButton className="w-full">Join our Discord first</JoinDiscordButton>

          <GoldDivider />
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
            Browser blocking OAuth? Use the manual scroll
          </p>

          <ManualSignupForm pendingTeamId={electedTeam?.id ?? null} />
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
