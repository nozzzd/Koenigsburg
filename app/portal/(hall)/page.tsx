import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Crown,
  ShieldCheck,
  Swords,
  UserRound,
} from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { getSupabase, type Team } from "@/lib/supabase";
import { GoldDivider, Panel, cardLinkClass } from "@/components/ui";
import { SaveKeyWarning } from "@/components/SaveKeyWarning";
import { NewsWidget } from "@/components/NewsWidget";
import { TasksWidget } from "@/components/TasksWidget";
import { MostNeededWidget } from "@/components/MostNeededWidget";
import { TeamPicker } from "@/components/TeamPicker";

export const metadata: Metadata = { title: "Citizen's Hall" };

const ROLE_LABELS = { guest: "Guest", citizen: "Citizen", admin: "Council Elder" } as const;

/**
 * Self-assignable teams + the player's memberships, for the team picker.
 * Degrades to nothing if the teams tables aren't migrated yet.
 */
async function loadTeamPickerData(playerId: string): Promise<{
  teams: Team[];
  memberTeamIds: string[];
  hasAnyTeam: boolean;
} | null> {
  const supabase = getSupabase();
  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .eq("self_assignable", true)
    .order("name")
    .returns<Team[]>();
  if (error) return null; // unmigrated or unavailable - hide the feature

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("player_id", playerId)
    .returns<{ team_id: string }[]>();
  const allIds = new Set((memberships ?? []).map((m) => m.team_id));
  const selfIds = (teams ?? []).map((t) => t.id).filter((id) => allIds.has(id));

  return {
    teams: teams ?? [],
    memberTeamIds: selfIds,
    hasAnyTeam: allIds.size > 0,
  };
}

export default async function PortalPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  const teamPicker = await loadTeamPickerData(player.id);

  const memberSince = new Date(player.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const facts = [
    { icon: Swords, label: "Minecraft Name", value: player.minecraft_ign },
    { icon: Crown, label: "Rank", value: ROLE_LABELS[player.role] },
    { icon: ShieldCheck, label: "Standing", value: "Active - Whitelisted" },
    { icon: CalendarDays, label: "Sworn In", value: memberSince },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          THE CITIZEN&apos;S HALL
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Hail, {player.minecraft_ign}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
          <UserRound className="h-4 w-4 text-slate-500" />@{player.discord_username}
        </p>
      </div>

      {!player.key_saved && <SaveKeyWarning code={player.verification_code} />}

      <GoldDivider />

      <div className="stagger grid gap-4 sm:grid-cols-2">
        {facts.map(({ icon: Icon, label, value }) => (
          <Panel key={label} className="p-5">
            <Icon className="h-5 w-5 text-gold-400" strokeWidth={1.5} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="mt-1 truncate font-semibold text-slate-100" title={value}>
              {value}
            </p>
          </Panel>
        ))}
      </div>

      {teamPicker && (
        <TeamPicker
          teams={teamPicker.teams}
          memberTeamIds={teamPicker.memberTeamIds}
          hasAnyTeam={teamPicker.hasAnyTeam}
        />
      )}

      <MostNeededWidget isAdmin={player.role === "admin"} />

      {player.role === "admin" && (
        <Link href="/portal/admin" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-6`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                ADMIN CONTROL PANEL
              </p>
              <p className="mt-1 text-sm text-slate-400">
                The queue, the roll, the Herald, and the Great Works.
              </p>
            </div>
            <Crown className="h-6 w-6 shrink-0 text-gold-400" />
          </Panel>
        </Link>
      )}

      {/* Phones have no sidebars - both boards ride along at the bottom. */}
      <TasksWidget
        playerId={player.id}
        isAdmin={player.role === "admin"}
        className="lg:hidden"
      />
      <NewsWidget className="lg:hidden" />
    </div>
  );
}
