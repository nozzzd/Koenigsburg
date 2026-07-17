"use client";

import { startTransition, useOptimistic } from "react";
import { ARCHETYPES } from "@/lib/quiz";
import type { Team } from "@/lib/supabase";
import { setRoleMapping } from "@/actions/quiz";
import { inputClass } from "@/components/ui";

/**
 * One row per archetype with a team dropdown. Changing it maps (or, on the
 * blank option, clears) that archetype -> team and syncs in the background.
 * Optimistic so the select reflects the choice instantly.
 */
export function QuizRoleMapper({
  teams,
  mapping,
}: {
  teams: Team[];
  /** archetype key -> team id, current server state. */
  mapping: Record<string, string>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    mapping,
    (prev, next: { archetype: string; teamId: string }) => {
      const copy = { ...prev };
      if (next.teamId) copy[next.archetype] = next.teamId;
      else delete copy[next.archetype];
      return copy;
    }
  );

  function change(archetype: string, teamId: string) {
    startTransition(async () => {
      setOptimistic({ archetype, teamId });
      await setRoleMapping(archetype, teamId || null);
    });
  }

  return (
    <ul className="space-y-3">
      {ARCHETYPES.map((a) => (
        <li
          key={a.key}
          className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-display text-sm font-bold tracking-wide text-slate-100">
              {a.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Recruits who align as {a.label}s can join this team on signup.
            </p>
          </div>
          <select
            aria-label={`Team for ${a.label}`}
            value={optimistic[a.key] ?? ""}
            onChange={(e) => change(a.key, e.target.value)}
            className={`${inputClass} sm:w-56`}
          >
            <option value="">No team (plain signup)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}
