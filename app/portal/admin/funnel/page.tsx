import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Database, TrendingUp } from "lucide-react";
import { getSupabase, type FunnelEvent, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { GoldDivider, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Admin - Recruitment Funnel" };
export const dynamic = "force-dynamic";

type Step = { label: string; hint: string; value: number };

function pct(n: number, of: number): string {
  if (of <= 0) return "-";
  return `${Math.round((n / of) * 100)}%`;
}

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const { range } = await searchParams;
  const days = range === "all" ? null : 7;
  const since = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const supabase = getSupabase();

  // Pre-signup steps: distinct visitors per event from funnel_events.
  let eventsQuery = supabase.from("funnel_events").select("event, visit_id");
  if (since) eventsQuery = eventsQuery.gte("created_at", since);
  const { data: events, error: funnelError } =
    await eventsQuery.returns<Pick<FunnelEvent, "event" | "visit_id">[]>();

  if (funnelError) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold tracking-widest text-slate-100">
          Recruitment Funnel
        </h1>
        <Panel className="flex items-start gap-3 border-amber-900/50 p-6">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-amber-300">
              The funnel table doesn&apos;t exist yet.
            </p>
            <p className="text-slate-400">
              Run{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-400">
                supabase/008_funnel.sql
              </code>{" "}
              in the Supabase SQL Editor, then reload.
            </p>
            <p className="text-xs text-slate-600">Details: {funnelError.message}</p>
          </div>
        </Panel>
      </div>
    );
  }

  // Distinct visitors per event.
  const distinct = new Map<string, Set<string>>();
  for (const e of events ?? []) {
    const set = distinct.get(e.event) ?? new Set<string>();
    set.add(e.visit_id);
    distinct.set(e.event, set);
  }
  const uniq = (event: string) => distinct.get(event)?.size ?? 0;

  // Post-signup steps: read straight from players (accurate, no event needed).
  let playersQuery = supabase.from("players").select("status, discord_id, created_at");
  if (since) playersQuery = playersQuery.gte("created_at", since);
  const { data: players } = await playersQuery.returns<
    Pick<Player, "status" | "discord_id" | "created_at">[]
  >();
  const rows = players ?? [];
  const signedUp = rows.length;
  const verified = rows.filter((p) => p.discord_id).length;
  const active = rows.filter((p) => p.status === "active").length;

  // The funnel, top to bottom. Each step's % is vs the step above it.
  const steps: Step[] = [
    { label: "Landed on the site", hint: "landing_view", value: uniq("landing_view") },
    { label: "Started the quiz", hint: "quiz_start", value: uniq("quiz_start") },
    { label: "Finished the quiz", hint: "quiz_finish", value: uniq("quiz_finish") },
    { label: "Reached the signup page", hint: "signup_view", value: uniq("signup_view") },
    { label: "Signed up", hint: "player rows", value: signedUp },
    { label: "Verified (linked Discord)", hint: "players.discord_id", value: verified },
    { label: "Active citizens", hint: "players.status", value: active },
  ];
  const top = Math.max(1, ...steps.map((s) => s.value));

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
        <p className="mt-4 flex items-center gap-2 font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          <TrendingUp className="h-4 w-4" />
          RECRUITMENT
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          The Funnel
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Where visitors drop off, from first arrival to sworn citizen. Pre-signup steps count
          distinct browsers; signup onward is read from the roll. Fix the biggest fall.
        </p>
      </div>

      <div className="flex gap-2">
        <Link
          href="/portal/admin/funnel"
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            !days || days === 7
              ? "border-gold-500/50 bg-gold-400/10 text-gold-300"
              : "border-slate-800 text-slate-400 hover:border-gold-500/40"
          }`}
        >
          Last 7 days
        </Link>
        <Link
          href="/portal/admin/funnel?range=all"
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            range === "all"
              ? "border-gold-500/50 bg-gold-400/10 text-gold-300"
              : "border-slate-800 text-slate-400 hover:border-gold-500/40"
          }`}
        >
          All time
        </Link>
      </div>

      <GoldDivider />

      <ul className="space-y-3">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          return (
            <li key={step.hint}>
              <Panel className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-sm font-bold tracking-wide text-slate-100">
                    {step.label}
                  </p>
                  <div className="flex items-baseline gap-3 text-sm">
                    {prev !== null && (
                      <span className="text-xs text-slate-500">
                        {pct(step.value, prev)} of prior
                      </span>
                    )}
                    <span className="font-display text-lg font-bold text-gold-300">
                      {step.value}
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300"
                    style={{ width: `${Math.max(2, (step.value / top) * 100)}%` }}
                  />
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>

      <Panel className="p-4 text-sm text-slate-400">
        <span className="font-semibold text-slate-200">Overall:</span>{" "}
        {uniq("landing_view") > 0 ? (
          <>
            {pct(active, uniq("landing_view"))} of visitors became active citizens (
            {active} of {uniq("landing_view")}).
          </>
        ) : (
          <>No landing views recorded yet in this window.</>
        )}
      </Panel>

      <Panel className="p-4 text-sm text-slate-400">
        <span className="font-semibold text-slate-200">Virality:</span>{" "}
        {uniq("quiz_share")} quiz {uniq("quiz_share") === 1 ? "taker" : "takers"} shared their
        result
        {uniq("quiz_finish") > 0 && <> ({pct(uniq("quiz_share"), uniq("quiz_finish"))} of finishers)</>}
        . Every share carries a link back to the quiz.
      </Panel>
    </div>
  );
}
