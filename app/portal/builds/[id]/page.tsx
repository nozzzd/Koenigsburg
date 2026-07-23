import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileBox,
  Hammer,
  Users,
} from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import {
  buildFileUrl,
  getAssigneeDirectory,
  getBuildFiles,
  getBuildProject,
} from "@/lib/builds";
import { GoldDivider, Panel } from "@/components/ui";
import { ItemIcon } from "@/components/ItemIcon";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { project } = await getBuildProject(id);
  return { title: project ? project.name : "Build" };
}

function pct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function count(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function CitizenBuildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  const { id } = await params;
  const { ready, project } = await getBuildProject(id);
  if (!ready || !project) notFound();

  const [files, directory] = await Promise.all([
    getBuildFiles(project.id),
    getAssigneeDirectory(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/builds"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All builds
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold capitalize text-slate-300">
            {project.status}
          </span>
          {project.satisfied && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Fully stocked
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          {project.name}
        </h1>
        {project.description && (
          <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{project.description}</p>
        )}

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {count(project.allocatedTotal)} / {count(project.requiredTotal)} gathered
              {project.missingTotal > 0 && (
                <span className="text-amber-400"> · {count(project.missingTotal)} short</span>
              )}
            </span>
            <span className="font-semibold text-gold-300">{pct(project.completion)}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all"
              style={{ width: `${pct(project.completion)}%` }}
            />
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <Panel className="p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <FileBox className="h-4 w-4" />
            SCHEMATICS
          </p>
          <ul className="mt-4 space-y-2">
            {files.map((f) => (
              <li key={f.id}>
                <a
                  href={buildFileUrl(f.storage_path)}
                  download={f.file_name}
                  className="pressable flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-2.5 hover:border-gold-500/50"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileBox className="h-4 w-4 shrink-0 text-gold-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-200">
                        {f.file_name}
                      </p>
                      <p className="text-xs text-slate-600">{formatBytes(f.size_bytes)}</p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <GoldDivider />

      <div>
        <h2 className="font-display text-sm font-bold tracking-widest text-slate-300">
          MATERIALS
        </h2>
        {project.items.length === 0 ? (
          <Panel className="mt-4 flex flex-col items-center gap-3 p-12 text-center">
            <Hammer className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
            <p className="text-sm text-slate-500">No materials listed for this build yet.</p>
          </Panel>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {project.items.map((item) => {
              const done = item.missing === 0;
              const teamName = item.assignedTeamId
                ? directory.teams.get(item.assignedTeamId)?.name
                : null;
              const playerName = item.assignedPlayerId
                ? directory.players.get(item.assignedPlayerId)
                : null;
              const assignee = teamName ?? playerName;
              const lineProgress =
                item.required > 0 ? item.allocated / item.required : 1;
              return (
                <li key={item.id}>
                  <Panel className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] mc-slot">
                          <ItemIcon
                            itemId={item.item_id}
                            label={item.display_name}
                            className="h-8 w-8"
                          />
                        </div>
                        <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-100">{item.display_name}</p>
                          {assignee && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-950/30 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                              <Users className="h-3 w-3" />
                              {assignee}
                            </span>
                          )}
                          {done ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Covered
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-700/40 bg-amber-950/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                              {count(item.missing)} short
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Need <span className="text-slate-300">{count(item.required)}</span> ·
                          gathered{" "}
                          <span className="text-slate-300">{count(item.allocated)}</span>
                        </p>
                        </div>
                      </div>
                      <div className="w-full sm:w-40">
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full ${done ? "bg-emerald-500/80" : "bg-gold-400/80"}`}
                            style={{ width: `${pct(lineProgress)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
