"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { Check, Search, Users, X } from "lucide-react";
import type { Team } from "@/lib/supabase";
import { selfAssignTeam, selfLeaveTeam } from "@/actions/teams";
import { Panel } from "@/components/ui";

/**
 * Lets a citizen join or leave the teams the council opened to everyone.
 *
 * Renders two things off one shared optimistic state:
 *   - a dashboard card showing the teams they're in + a "Choose your teams" button
 *   - a searchable modal to toggle membership, one click each, no reload
 *
 * The modal auto-opens once per session for a citizen who is in no team at all,
 * so newcomers are nudged to pick. It stays out of the way after that; the card
 * button is always there to reopen it. Built to scale to many teams: the list
 * searches and scrolls.
 */
export function TeamPicker({
  teams,
  memberTeamIds,
  hasAnyTeam,
}: {
  /** Self-assignable teams only. */
  teams: Team[];
  /** Which of `teams` the citizen currently belongs to. */
  memberTeamIds: string[];
  /** True if they belong to ANY team (self or admin-assigned) — gates auto-open. */
  hasAnyTeam: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [optimisticIds, toggleOptimistic] = useOptimistic(
    new Set(memberTeamIds),
    (set: Set<string>, id: string) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    }
  );
  const [query, setQuery] = useState("");

  // Nudge team-less citizens once per session.
  useEffect(() => {
    if (hasAnyTeam || teams.length === 0) return;
    try {
      if (sessionStorage.getItem("kbg-team-prompt") === "done") return;
      sessionStorage.setItem("kbg-team-prompt", "done");
    } catch {
      /* private mode — just skip the once-per-session guard */
    }
    ref.current?.showModal();
  }, [hasAnyTeam, teams.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    );
  }, [teams, query]);

  function toggle(team: Team) {
    const isMember = optimisticIds.has(team.id);
    startTransition(async () => {
      toggleOptimistic(team.id);
      if (isMember) await selfLeaveTeam(team.id);
      else await selfAssignTeam(team.id);
    });
  }

  // Nothing the council has opened up — no card, no button.
  if (teams.length === 0) return null;

  const joined = teams.filter((t) => optimisticIds.has(t.id));

  return (
    <>
      <Panel className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
              <Users className="h-4 w-4" />
              YOUR TEAMS
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Join the teams open to every citizen. Pick as many as fit you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.showModal()}
            className="pressable shrink-0 rounded-lg border border-gold-500/40 px-3 py-1.5 text-xs font-semibold text-gold-300 hover:border-gold-400 hover:bg-gold-400/10"
          >
            Choose your teams
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {joined.length === 0 ? (
            <p className="text-sm text-slate-500">
              You haven&apos;t joined any teams yet.
            </p>
          ) : (
            joined.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-xs font-semibold text-slate-200"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-slate-600"
                  style={{ backgroundColor: t.color ?? "#64748b" }}
                />
                {t.name}
              </span>
            ))
          )}
        </div>
      </Panel>

      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="modal m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-transparent p-0 text-slate-200 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-sm font-bold tracking-[0.3em] text-gold-400">
                CHOOSE YOUR TEAMS
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Tap a team to join it. Tap again to leave. Changes save instantly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {teams.length > 6 && (
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams…"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-gold-500/50"
              />
            </div>
          )}

          <div className="mt-4 max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="px-1 py-3 text-sm text-slate-600">No teams match.</p>
            ) : (
              filtered.map((team) => {
                const on = optimisticIds.has(team.id);
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggle(team)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition ${
                      on
                        ? "border-gold-500/40 bg-gold-400/5"
                        : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-600"
                      style={{ backgroundColor: team.color ?? "#64748b" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-bold tracking-wide text-slate-100">
                        {team.name}
                      </span>
                      {team.description && (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {team.description}
                        </span>
                      )}
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        on
                          ? "border-gold-500/60 bg-gold-400/20 text-gold-300"
                          : "border-slate-700 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="mt-5 w-full rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-gold-500/50 hover:text-gold-300"
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
