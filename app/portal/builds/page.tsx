import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Hammer } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { getBuildOverview, type AllocatedProject } from "@/lib/builds";
import { GoldDivider, Panel, cardLinkClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "The Realm's Builds" };

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

function ProjectCard({ project }: { project: AllocatedProject }) {
  return (
    <Link href={`/portal/builds/${project.id}`} className="block">
      <Panel className={`${cardLinkClass} p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[project.status]}`}
              >
                {project.status}
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
              <p className="mt-0.5 truncate text-sm text-slate-500">{project.description}</p>
            )}
          </div>
          <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-600" />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {count(project.allocatedTotal)} / {count(project.requiredTotal)} gathered
            </span>
            <span className="font-semibold text-gold-300">{pct(project.completion)}%</span>
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
  );
}

export default async function CitizenBuildsPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  const overview = await getBuildOverview();
  const active = overview.projects.filter((p) => p.status === "active");
  const others = overview.projects.filter((p) => p.status !== "active");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          The Citizen&apos;s Hall
        </Link>
        <p className="mt-4 font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          THE REALM&apos;S
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Great Builds
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Every project the nation is raising, and how much of each still needs gathering.
          Open one to see the materials, who&apos;s on them, and any schematics to download.
        </p>
      </div>

      <GoldDivider />

      {!overview.ready || overview.projects.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <Hammer className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            NOTHING UNDER CONSTRUCTION
          </p>
          <p className="text-sm text-slate-500">
            No builds have been posted yet. Check back soon.
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <ul className="space-y-3">
              {active.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          )}

          {others.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="font-display text-xs font-semibold tracking-[0.3em] text-slate-500">
                ARCHIVED &amp; COMPLETED
              </p>
              <ul className="space-y-3">
                {others.map((project) => (
                  <li key={project.id}>
                    <ProjectCard project={project} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
