import { Check, Crown, Lock, ScrollText, ShieldOff, Trash2, UserMinus } from "lucide-react";
import type { Player } from "@/lib/supabase";
import { approvePlayer } from "@/actions/admin";
import { removeMember, revokeCitizenship } from "@/actions/members";
import { Panel } from "@/components/ui";

const ROLE_LABEL: Record<Player["role"], string> = {
  guest: "Guest",
  citizen: "Citizen",
  admin: "Council Elder",
};

const actionButtonClass =
  "pressable inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold";

/**
 * One member of the realm.
 *
 * EXTENDING THIS: new per-member data (jobs, plots, titles…) belongs in the
 * meta row below, and new admin controls go in the actions column. Both are
 * additive - nothing else in the roster needs to change.
 */
export function MemberRow({
  member,
  isSelf,
  discordIssue,
}: {
  member: Player;
  isSelf: boolean;
  /** Why this Discord-linked account no longer qualifies for citizenship. */
  discordIssue?: "left" | "missing-role";
}) {
  const isPending = member.status === "pending";

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-base font-bold tracking-wide text-slate-100">
            {member.minecraft_ign}
          </p>
          {member.role === "admin" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-400/10 px-2 py-0.5 text-xs font-semibold text-gold-300">
              <Crown className="h-3 w-3" />
              Elder
            </span>
          )}
          {isSelf && (
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500">
              you
            </span>
          )}
        </div>

        <p className="truncate text-sm text-slate-400">@{member.discord_username}</p>

        {/* meta row - add future per-member fields here */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
          <span
            className={
              isPending
                ? "rounded-full border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 font-semibold text-amber-300"
                : "rounded-full border border-emerald-600/40 bg-emerald-950/30 px-2 py-0.5 font-semibold text-emerald-300"
            }
          >
            {isPending ? "Pending" : "Active"}
          </span>
          {discordIssue && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-600/50 bg-red-950/40 px-2 py-0.5 font-semibold text-red-300">
              {discordIssue === "left" ? (
                <UserMinus className="h-3 w-3" />
              ) : (
                <ShieldOff className="h-3 w-3" />
              )}
              {discordIssue === "left" ? "Left Discord" : "Missing @Citizen"}
            </span>
          )}
          <span className="text-slate-500">{ROLE_LABEL[member.role]}</span>
          {member.discord_id ? (
            <span className="rounded-full border border-indigo-500/40 px-2 py-0.5 text-indigo-300">
              Discord-linked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-slate-500">
              <ScrollText className="h-3 w-3" />
              Manual · {member.verification_code}
            </span>
          )}
          <span className="text-slate-600">
            joined{" "}
            {new Date(member.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* actions - add future admin controls here */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {isPending &&
          (member.discord_id ? (
            discordIssue === "left" ? (
              <span
                title="They must rejoin the Discord before citizenship can be restored."
                className={`${actionButtonClass} cursor-not-allowed border-slate-800 text-slate-600`}
              >
                <UserMinus className="h-3.5 w-3.5" />
                Not in Discord
              </span>
            ) : (
              <form action={approvePlayer.bind(null, member.id)}>
                <button
                  type="submit"
                  className={`${actionButtonClass} border-emerald-700/60 text-emerald-300 hover:border-emerald-500 hover:bg-emerald-950/50`}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </button>
              </form>
            )
          ) : (
            <span
              title="They must run /verify with their code before they can be approved."
              className={`${actionButtonClass} cursor-not-allowed border-slate-800 text-slate-600`}
            >
              <Lock className="h-3.5 w-3.5" />
              Awaiting /verify
            </span>
          ))}

        {!isSelf && !isPending && (
          <form action={revokeCitizenship.bind(null, member.id)}>
            <button
              type="submit"
              title="Strip @Citizen and send back to pending - reversible"
              className={`${actionButtonClass} border-slate-700 text-slate-400 hover:border-amber-700 hover:bg-amber-950/40 hover:text-amber-300`}
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Revoke
            </button>
          </form>
        )}

        {!isSelf && (
          <form action={removeMember.bind(null, member.id)}>
            <button
              type="submit"
              title="Erase the record entirely - irreversible"
              className={`${actionButtonClass} border-slate-800 text-slate-500 hover:border-red-800 hover:bg-red-950/40 hover:text-red-300`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Kick
            </button>
          </form>
        )}
      </div>
    </Panel>
  );
}
