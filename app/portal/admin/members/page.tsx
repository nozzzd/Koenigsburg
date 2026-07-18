import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserMinus, Users } from "lucide-react";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { listGuildMemberIds } from "@/lib/discord";
import { GoldDivider, Panel } from "@/components/ui";
import { MemberRow } from "@/components/admin/MemberRow";

export const metadata: Metadata = { title: "Admin — The Roll of Königsburg" };

// Always live: departures must be caught on load, not served from cache.
export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const { data, error } = await getSupabase()
    .from("players")
    .select("*")
    .order("created_at", { ascending: true })
    .returns<Player[]>();

  if (error) {
    throw new Error(`Failed to load the roll: ${error.message}`);
  }

  const members = data ?? [];

  // Flag anyone Discord-linked (active OR pending, so the flag survives a
  // Revoke) who is no longer in the server. One bulk member list instead of a
  // per-member request avoids Discord rate limits — the old per-member burst
  // silently skipped anyone that got rate-limited, so real departures slipped
  // through. If the bulk call fails (Server Members Intent off, or an outage)
  // we flag NOBODY and surface a warning, rather than guessing.
  const departed = new Set<string>();
  let checkFailed = false;
  try {
    const guildIds = await listGuildMemberIds();
    for (const m of members) {
      if (m.discord_id && m.role !== "admin" && !guildIds.has(m.discord_id)) {
        departed.add(m.id);
      }
    }
  } catch (err) {
    console.error("Guild member list failed; skipping departure check:", err);
    checkFailed = true;
  }
  const stats = [
    { label: "Souls", value: members.length },
    { label: "Citizens", value: members.filter((m) => m.status === "active").length },
    { label: "Pending", value: members.filter((m) => m.status === "pending").length },
    { label: "Left Discord", value: departed.size },
  ];

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
          THE ROLL OF
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Königsburg
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Every soul on record.{" "}
          <span className="text-slate-500">Revoke</span> strips @Citizen and returns
          them to pending (reversible);{" "}
          <span className="text-slate-500">Kick</span> erases the record entirely.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {stats.map(({ label, value }) => (
          <Panel key={label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-gold-300">{value}</p>
          </Panel>
        ))}
      </div>

      {checkFailed && (
        <Panel className="flex items-start gap-3 border-amber-900/50 bg-amber-950/20 p-5">
          <UserMinus className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-300">
              Couldn&apos;t check who&apos;s still in the Discord.
            </p>
            <p className="text-slate-400">
              The departure check is skipped this load — no one is flagged. Enable the bot&apos;s{" "}
              <span className="text-slate-200">Server Members Intent</span> (Discord Developer
              Portal → Bot → Privileged Gateway Intents), then reload.
            </p>
          </div>
        </Panel>
      )}

      {departed.size > 0 && (
        <Panel className="flex items-start gap-3 border-red-900/50 bg-red-950/20 p-5">
          <UserMinus className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-red-300">
              {departed.size} member{departed.size === 1 ? "" : "s"} left the Discord while still
              on the roll.
            </p>
            <p className="text-slate-400">
              {members
                .filter((m) => departed.has(m.id))
                .map((m) => m.minecraft_ign)
                .join(", ")}
              . They&apos;ve lost portal access already — Revoke or Kick them below to clear the
              roll.
            </p>
          </div>
        </Panel>
      )}

      <GoldDivider />

      {members.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <Users className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            THE ROLL IS EMPTY
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {members.map((member) => (
            <li key={member.id}>
              <MemberRow
                member={member}
                isSelf={member.id === player.id}
                departed={departed.has(member.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
