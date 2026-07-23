import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Database,
  Hammer,
  PackageOpen,
  TriangleAlert,
} from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { getBuildOverview, type AllocatedProject } from "@/lib/builds";
import { GoldDivider, Panel, cardLinkClass } from "@/components/ui";
import { CreateBuildProjectForm } from "@/components/forms/BuildForms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — The Master Plan" };

function pct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function count(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

const STATUS_STYLE: Record<AllocatedProject["status"], string> = {
  active: "border-emerald-600/40 bg-emerald-950/30 text-emerald-300",
  completed: "border-gold-500/40 bg-gold-400/10 text-gold-300",
  archived: "border-slate-700 bg-slate-900 text-slate-400",
};

export default async function AdminBuildsPage() {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const overview = await getBuildOverview();

  if (!overview.ready) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold tracking-widest text-slate-100">
          The Master Plan
        </h1>
        <Panel className="flex items-start gap-3 border-amber-900/50 p-6">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-amber-300">
              The build-planner tables don&apos;t exist yet.
            </p>
            <p className="text-slate-400">
              Open the Supabase SQL Editor and run{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-400">
                supabase/013_build_projects.sql
              </code>{" "}
              from the repo, then reload this page.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  const { projects, shortfalls, receiverConfigured } = overview;
  const active = projects.filter((p) => p.status === "active");
  const others = projects.filter((p) => p.status !== "active");

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
          THE MASTER
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Plan
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Declare what each build needs. The nation&apos;s live stock is shared across every
          active project in priority order, so a stack promised to the cathedral is never
          counted again for the harbour wall.
        </p>
        {!receiverConfigured && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            No QMSync server configured — every requirement will read as missing until stock
            syncs.
          </p>
        )}
      </div>

      <GoldDivider />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {active.length === 0 ? (
            <Panel className="flex flex-col items-center gap-3 p-12 text-center">
              <Hammer className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
              <p className="font-display text-sm font-bold tracking-widest text-slate-300">
                NOTHING ON THE DRAWING BOARD
              </p>
              <p className="text-sm text-slate-500">
                Found a project to start planning materials.
              </p>
            </Panel>
          ) : (
            <ul className="space-y-3">
              {active.map((project) => (
                <li key={project.id}>
                  <Link href={`/portal/admin/builds/${project.id}`} className="block">
                    <Panel className={`${cardLinkClass} p-5`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[project.status]}`}
                            >
                              {project.status}
                            </span>
                            <span className="text-xs text-slate-600">
                              Priority {project.priority}
                            </span>
                            {project.satisfied && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                Fully stocked
                              </span>
                            )}
                          </div>
                          <p className="mt-2 truncate font-display text-lg font-bold tracking-wide text-slate-100">
                            {project.name}
                          </p>
                          {project.description && (
                            <p className="mt-0.5 truncate text-sm text-slate-500">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-600" />
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {count(project.allocatedTotal)} / {count(project.requiredTotal)}{" "}
                            reserved
                          </span>
                          <span className="font-semibold text-gold-300">
                            {pct(project.completion)}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all"
                            style={{ width: `${pct(project.completion)}%` }}
                          />
                        </div>
                        {project.missingTotal > 0 && (
                          <p className="mt-1.5 text-xs text-amber-400">
                            {count(project.missingTotal)} still to gather
                          </p>
                        )}
                      </div>
                    </Panel>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {others.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="font-display text-xs font-semibold tracking-[0.3em] text-slate-500">
                ARCHIVED &amp; COMPLETED
              </p>
              <ul className="space-y-2">
                {others.map((project) => (
                  <li key={project.id}>
                    <Link href={`/portal/admin/builds/${project.id}`} className="block">
                      <Panel className={`${cardLinkClass} flex items-center justify-between gap-3 p-3.5`}>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[project.status]}`}
                          >
                            {project.status}
                          </span>
                          <span className="truncate text-sm text-slate-300">{project.name}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-600" />
                      </Panel>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Panel className="p-5">
            <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
              <Hammer className="h-4 w-4" />
              FOUND A PROJECT
            </p>
            <div className="mt-4">
              <CreateBuildProjectForm />
            </div>
          </Panel>

          <Panel className="p-5">
            <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
              <Boxes className="h-4 w-4" />
              WHAT THE NATION LACKS
            </p>
            {shortfalls.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
                <PackageOpen className="h-6 w-6 text-emerald-400" strokeWidth={1.5} />
                <p className="text-sm text-slate-400">
                  Every active project is fully stocked.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-1.5">
                {shortfalls.slice(0, 15).map((s) => (
                  <li
                    key={s.item_id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-slate-300">{s.display_name}</span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-amber-400">
                      {count(s.missing)}
                    </span>
                  </li>
                ))}
                {shortfalls.length > 15 && (
                  <li className="pt-1 text-xs text-slate-600">
                    +{shortfalls.length - 15} more items short
                  </li>
                )}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
