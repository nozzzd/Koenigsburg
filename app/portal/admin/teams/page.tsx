import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Database, Pencil, Users, X } from "lucide-react";
import { getSupabase, type Player, type Team } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { deleteTeam } from "@/actions/teams";
import { GoldDivider, Panel } from "@/components/ui";
import { CreateTeamForm, EditTeamForm } from "@/components/forms/TeamForms";
import { TeamRoster } from "@/components/TeamRoster";

export const metadata: Metadata = { title: "Admin - Teams" };

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
          can mirror a Discord role - joining assigns it, leaving strips it.
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

        <Panel className="flex flex-col justify-center p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <ClipboardList className="h-4 w-4" />
            TEAM TASKS
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Assign a task to a whole team from{" "}
            <Link
              href="/portal/admin/tasks"
              className="font-semibold text-gold-400 hover:text-gold-300"
            >
              the Ledger
            </Link>
            , where every kind of task is managed together.
          </p>
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
                        <span className="text-xs text-slate-600">
                          {roster.length} member{roster.length === 1 ? "" : "s"}
                        </span>
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

                  {/* Rename / recolour - collapsible so it doesn't clutter the card. */}
                  <details className="mt-4 group">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300 [&::-webkit-details-marker]:hidden">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit name, description &amp; colour
                    </summary>
                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <EditTeamForm team={team} />
                    </div>
                  </details>

                  {/* Click a name to add/remove - instant, searchable. */}
                  <div className="mt-4">
                    <TeamRoster
                      teamId={team.id}
                      allMembers={allMembers}
                      memberIds={roster.map((m) => m.id)}
                    />
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
