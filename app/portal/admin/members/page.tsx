import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserMinus, Users } from "lucide-react";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import {
  getGuildMemberRoles,
  listGuildMembership,
  rolesIncludeCitizen,
} from "@/lib/discord";
import { GoldDivider, Panel } from "@/components/ui";
import { MemberRow } from "@/components/admin/MemberRow";

type DiscordIssue = "left" | "missing-role";

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

  let members = data ?? [];

  // Discord is the source of truth for linked citizens. One bulk member roll
  // provides almost every answer; if an active player is unexpectedly absent
  // from that roll, confirm them individually before doing anything destructive.
  // Any Discord failure is fail-open: uncertain accounts stay untouched.
  const discordIssues = new Map<string, DiscordIssue>();
  const automaticallyRevoked = new Set<string>();
  let checkFailed = false;
  let revokeFailed = false;
  try {
    const guildMembers = await listGuildMembership();
    for (const member of members) {
      if (!member.discord_id || member.role === "admin") continue;

      let roles: string[] | null;
      if (guildMembers.has(member.discord_id)) {
        roles = guildMembers.get(member.discord_id) ?? [];
      } else if (member.status === "active") {
        try {
          roles = await getGuildMemberRoles(member.discord_id);
        } catch (err) {
          console.error("Individual Discord membership confirmation failed:", err);
          checkFailed = true;
          continue;
        }
      } else {
        // This is display-only for an account already pending; no mutation is
        // based on an unconfirmed absence from the bulk roll.
        discordIssues.set(member.id, "left");
        continue;
      }

      if (roles === null) {
        discordIssues.set(member.id, "left");
      } else if (member.status === "active" && !rolesIncludeCitizen(roles)) {
        discordIssues.set(member.id, "missing-role");
      }

      if (
        member.status === "active" &&
        (roles === null || !rolesIncludeCitizen(roles))
      ) {
        automaticallyRevoked.add(member.id);
      }
    }

    if (automaticallyRevoked.size > 0) {
      const { error: revokeError } = await getSupabase()
        .from("players")
        .update({ status: "pending", role: "guest" })
        .in("id", [...automaticallyRevoked])
        .eq("status", "active")
        .neq("role", "admin");
      if (revokeError) {
        console.error("Bulk Discord citizenship reconciliation failed:", revokeError);
        revokeFailed = true;
      } else {
        members = members.map((member): Player =>
          automaticallyRevoked.has(member.id)
            ? { ...member, status: "pending", role: "guest" }
            : member
        );
      }
    }
  } catch (err) {
    console.error("Guild member list failed; skipping citizenship reconciliation:", err);
    checkFailed = true;
  }

  const stats = [
    { label: "Souls", value: members.length },
    { label: "Citizens", value: members.filter((m) => m.status === "active").length },
    { label: "Pending", value: members.filter((m) => m.status === "pending").length },
    { label: "Discord issues", value: discordIssues.size },
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
              Any uncertain account was left unchanged. Enable the bot&apos;s{" "}
              <span className="text-slate-200">Server Members Intent</span> (Discord Developer
              Portal → Bot → Privileged Gateway Intents), then reload.
            </p>
          </div>
        </Panel>
      )}

      {revokeFailed && (
        <Panel className="flex items-start gap-3 border-amber-900/50 bg-amber-950/20 p-5">
          <UserMinus className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-300">
              Discord changes were found, but the roll could not be updated.
            </p>
            <p className="text-slate-400">
              Those accounts are denied when they next make a protected request. Check the
              Supabase connection, then reload to persist their pending status.
            </p>
          </div>
        </Panel>
      )}

      {discordIssues.size > 0 && (
        <Panel className="flex items-start gap-3 border-red-900/50 bg-red-950/20 p-5">
          <UserMinus className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-red-300">
              {discordIssues.size} member{discordIssues.size === 1 ? "" : "s"} no longer meets the
              Discord citizenship requirement.
            </p>
            <p className="text-slate-400">
              {members
                .filter((m) => discordIssues.has(m.id))
                .map((m) => m.minecraft_ign)
                .join(", ")}
              .{" "}
              {automaticallyRevoked.size > 0
                ? revokeFailed
                  ? "Their active accounts are denied on protected requests, but the pending status still needs to be persisted."
                  : `${automaticallyRevoked.size} active account${
                      automaticallyRevoked.size === 1 ? " was" : "s were"
                    } automatically moved to pending.`
                : "These accounts were already pending."}
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
                discordIssue={discordIssues.get(member.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
