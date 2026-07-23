"use client";

import { startTransition, useMemo, useOptimistic, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Player } from "@/lib/supabase";
import { addTeamMemberById, removeTeamMember } from "@/actions/teams";

/**
 * Click-to-toggle team membership. Every active member is listed; the ones on
 * the team are ticked. Clicking a name flips them in or out immediately
 * (useOptimistic) and syncs in the background - no Add button, no reload wait.
 */
export function TeamRoster({
  teamId,
  allMembers,
  memberIds,
}: {
  teamId: string;
  allMembers: Player[];
  memberIds: string[];
}) {
  const [optimisticIds, toggleOptimistic] = useOptimistic(
    new Set(memberIds),
    (set: Set<string>, id: string) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    }
  );
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allMembers;
    return allMembers.filter(
      (m) =>
        m.minecraft_ign.toLowerCase().includes(q) ||
        m.discord_username.toLowerCase().includes(q)
    );
  }, [allMembers, query]);

  function toggle(member: Player) {
    const isMember = optimisticIds.has(member.id);
    startTransition(async () => {
      toggleOptimistic(member.id);
      if (isMember) {
        await removeTeamMember(teamId, member.id);
      } else {
        await addTeamMemberById(teamId, member.id);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-gold-500/50"
        />
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-xs text-slate-600">No one matches.</p>
        ) : (
          filtered.map((member) => {
            const on = optimisticIds.has(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggle(member)}
                className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition ${
                  on
                    ? "border-gold-500/40 bg-gold-400/5 text-slate-100"
                    : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-800/40 hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                    on
                      ? "border-gold-500/60 bg-gold-400/20 text-gold-300"
                      : "border-slate-700 text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 truncate">{member.minecraft_ign}</span>
                <span className="shrink-0 text-xs text-slate-600">
                  @{member.discord_username}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
