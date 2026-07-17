import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Database, Hash, Users, X } from "lucide-react";
import { getSupabase, type Player, type Team } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { deleteTeam, removeTeamMember } from "@/actions/teams";
import { GoldDivider, Panel } from "@/components/ui";
import {
  AddTeamMemberForm,
  AssignTeamTaskForm,
  CreateTeamForm,
} from "@/components/forms/TeamForms";

export const metadata: Metadata = { title: "Admin — Teams" };

type MemberRow = { team_id: string; players: Player | null };

export default async function AdminTeamsPage() {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const supabase = getSupabase();
  const [{ data: teamRows, error }, { data: memberRows }] = await Promise.all([
    supabase.from("teams").select("*").order("name").returns<Team[]>(),
    supabase
      .from("players")
      .select("*")
      .eq("status", "active")
      .order("minecraft_ign")
      .returns<Player[]>(),
  ]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold tracking-widest text-slate-100">
          Teams
        </h1>
        <Panel className="flex items-start gap-3 border-amber-900/50 p-6">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-amber-300">
              The teams tables don&apos;t exist yet.
            </p>
            <p className="text-slate-400">
              Run{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-400">
                supabase/006_teams.sql
              </code>{" "}
              in the Supabase SQL Editor, then reload.
            </p>
            <p className="text-xs text-slate-600">Details: {error.message}</p>
          </div>
        </Panel>
      </div>
    );
  }

  const teams = teamRows ?? [];
  const allMembers = memberRows ?? [];

  // Membership per team, in one query.
  const { data: membershipRows } = await supabase
    .from("team_members")
    .select("team_id, players(*)")
    .order("joined_at")
    .returns<MemberRow[]>();
  const byTeam = new Map<string, Player[]>();
  for (const row of membershipRows ?? []) {
    if (!row.players) continue;
    const list = byTeam.get(row.team_id) ?? [];
    list.push(row.players);
    byTeam.set(row.team_id, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the Great Hall
        </Link>
        <p className="mt-4 font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          THE GUILDS OF
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Königsburg
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Group members into teams and assign whole teams a task at once. A team
          can mirror a Discord role — joining assigns it, leaving strips it.
        </p>
      </div>

      <GoldDivider />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <Users className="h-4 w-4" />
            FOUND A TEAM
          </p>
          <div className="mt-4">
            <CreateTeamForm />
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <Hash className="h-4 w-4" />
            ASSIGN A TEAM TASK
          </p>
          <div className="mt-4">
            {teams.length === 0 ? (
              <p className="text-sm text-slate-500">Found a team first.</p>
            ) : (
              <AssignTeamTaskForm teams={teams} />
            )}
          </div>
        </Panel>
      </div>

      <GoldDivider />

      {teams.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <Users className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            NO TEAMS YET
          </p>
          <p className="text-sm text-slate-500">Found the first one above.</p>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {teams.map((team) => {
            const roster = byTeam.get(team.id) ?? [];
            const rosterIds = new Set(roster.map((m) => m.id));
            const available = allMembers.filter((m) => !rosterIds.has(m.id));
            return (
              <li key={team.id}>
                <Panel className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-slate-700"
                          style={{ backgroundColor: team.color ?? "#64748b" }}
                        />
                        <p className="font-display text-lg font-bold tracking-wide text-slate-100">
                          {team.name}
                        </p>
                        {team.discord_role_id ? (
                          <span className="rounded-full border border-indigo-500/40 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                            Discord-linked
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500">
                            Website-only
                          </span>
                        )}
                      </div>
                      {team.description && (
                        <p className="mt-1 text-sm text-slate-400">{team.description}</p>
                      )}
                    </div>
                    <form action={deleteTeam.bind(null, team.id)}>
                      <button
                        type="submit"
                        className="pressable inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-800 hover:bg-red-950/40 hover:text-red-300"
                      >
                        <X className="h-3.5 w-3.5" />
                        Disband
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {roster.length === 0 ? (
                      <p className="text-xs text-slate-600">No members yet.</p>
                    ) : (
                      roster.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/60 py-0.5 pl-2.5 pr-1 text-xs text-slate-300"
                        >
                          {m.minecraft_ign}
                          <form action={removeTeamMember.bind(null, team.id, m.id)}>
                            <button
                              type="submit"
                              aria-label={`Remove ${m.minecraft_ign}`}
                              className="rounded-full p-0.5 text-slate-600 transition hover:text-red-400"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </form>
                        </span>
                      ))
                    )}
                  </div>

                  {available.length > 0 && (
                    <div className="mt-4">
                      <AddTeamMemberForm teamId={team.id} members={available} />
                    </div>
                  )}
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
