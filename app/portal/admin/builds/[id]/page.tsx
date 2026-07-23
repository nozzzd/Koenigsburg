import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  FileBox,
  Hammer,
  ListPlus,
  Lock,
  LockOpen,
  RotateCcw,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import {
  buildFileUrl,
  getAssigneeDirectory,
  getBuildFiles,
  getBuildProject,
} from "@/lib/builds";
import {
  deleteBuildFile,
  deleteBuildProject,
  removeBuildItem,
  setBuildStatus,
  toggleBuildItemLock,
} from "@/actions/builds";
import { GoldDivider, Panel } from "@/components/ui";
import { ItemIcon } from "@/components/ItemIcon";
import { RemoveItemButton } from "@/components/RemoveItemButton";
import { MINECRAFT_ITEM_IDS } from "@/lib/minecraft-items";
import {
  AddBuildItemForm,
  AssignItemForm,
  EditBuildItemForm,
  EditBuildProjectForm,
  ImportMaterialsForm,
  UploadBuildFileForm,
} from "@/components/forms/BuildForms";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { project } = await getBuildProject(id);
  return { title: project ? `Admin — ${project.name}` : "Admin — Build" };
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

export default async function AdminBuildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const { id } = await params;
  const { ready, project } = await getBuildProject(id);

  if (!ready) {
    return (
      <Panel className="flex items-start gap-3 border-amber-900/50 p-6">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-amber-300">
            The build-planner tables don&apos;t exist yet.
          </p>
          <p className="text-slate-400">
            Run{" "}
            <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-400">
              supabase/013_build_projects.sql
            </code>{" "}
            in Supabase, then reload.
          </p>
        </div>
      </Panel>
    );
  }

  if (!project) notFound();

  const [files, directory] = await Promise.all([
    getBuildFiles(project.id),
    getAssigneeDirectory(),
  ]);
  const teamOptions = [...directory.teams].map(([id, t]) => ({ id, name: t.name }));
  const playerOptions = [...directory.players].map(([id, ign]) => ({ id, ign }));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/admin/builds"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          The Master Plan
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold capitalize text-slate-300">
                {project.status}
              </span>
              <span className="text-xs text-slate-600">Priority {project.priority}</span>
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
          </div>

          <div className="flex flex-wrap gap-2">
            {project.status !== "active" && (
              <form action={setBuildStatus.bind(null, project.id, "active")}>
                <button className="pressable inline-flex items-center gap-1.5 rounded-md border border-emerald-800 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/40">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reactivate
                </button>
              </form>
            )}
            {project.status !== "completed" && (
              <form action={setBuildStatus.bind(null, project.id, "completed")}>
                <button className="pressable inline-flex items-center gap-1.5 rounded-md border border-gold-600/40 px-2.5 py-1.5 text-xs font-semibold text-gold-300 hover:bg-gold-400/10">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Complete
                </button>
              </form>
            )}
            {project.status !== "archived" && (
              <form action={setBuildStatus.bind(null, project.id, "archived")}>
                <button className="pressable inline-flex items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </button>
              </form>
            )}
            <form action={deleteBuildProject.bind(null, project.id)}>
              <button className="pressable inline-flex items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-800 hover:bg-red-950/40 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </form>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {count(project.allocatedTotal)} / {count(project.requiredTotal)} reserved
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

      <GoldDivider />

      {/* Requirements */}
      {project.items.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <Hammer className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            NO MATERIALS DECLARED
          </p>
          <p className="text-sm text-slate-500">
            Add a requirement or import a material list below.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-2.5">
          {project.items.map((item) => {
            const done = item.missing === 0;
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
                        {item.locked && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-950/30 px-2 py-0.5 text-xs font-semibold text-sky-300">
                            <Lock className="h-3 w-3" />
                            Priority claim
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
                      <p className="mt-1 font-mono text-xs text-slate-600">{item.item_id}</p>
                      {(() => {
                        const teamName = item.assignedTeamId
                          ? directory.teams.get(item.assignedTeamId)?.name
                          : null;
                        const playerName = item.assignedPlayerId
                          ? directory.players.get(item.assignedPlayerId)
                          : null;
                        if (!teamName && !playerName) return null;
                        return (
                          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-950/30 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                            <Users className="h-3 w-3" />
                            {teamName ?? playerName}
                          </p>
                        );
                      })()}
                      <p className="mt-2 text-xs text-slate-500">
                        Need <span className="text-slate-300">{count(item.required)}</span> ·
                        reserved <span className="text-slate-300">{count(item.allocated)}</span>{" "}
                        · <span className="text-slate-400">{count(item.available)}</span> in
                        stock server-wide
                        {item.override !== null && (
                          <span className="text-sky-300"> · override {count(item.override)}</span>
                        )}
                      </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <form
                        action={toggleBuildItemLock.bind(
                          null,
                          item.id,
                          project.id,
                          !item.locked
                        )}
                      >
                        <button
                          aria-label={item.locked ? "Unlock" : "Lock priority claim"}
                          className="pressable inline-flex items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:border-sky-700 hover:text-sky-300"
                        >
                          {item.locked ? (
                            <LockOpen className="h-3.5 w-3.5" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </form>
                      <RemoveItemButton
                        action={removeBuildItem.bind(null, item.id, project.id)}
                        label={`Remove ${item.display_name}`}
                      />
                    </div>
                  </div>

                  <div className="mt-3 space-y-3 border-t border-slate-800/70 pt-3">
                    <EditBuildItemForm
                      itemRowId={item.id}
                      projectId={project.id}
                      required={item.required}
                      override={item.override}
                    />
                    <AssignItemForm
                      itemRowId={item.id}
                      projectId={project.id}
                      current={
                        item.assignedTeamId
                          ? `team:${item.assignedTeamId}`
                          : item.assignedPlayerId
                            ? `player:${item.assignedPlayerId}`
                            : ""
                      }
                      teams={teamOptions}
                      players={playerOptions}
                    />
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      <GoldDivider />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <ListPlus className="h-4 w-4" />
            ADD A REQUIREMENT
          </p>
          <div className="mt-4">
            <AddBuildItemForm projectId={project.id} />
          </div>
          {/* Real item ids, for the add form's autocomplete. Server-rendered so
              the 1,300-entry list stays out of the client JS bundle. */}
          <datalist id="mc-item-ids">
            {MINECRAFT_ITEM_IDS.map((id) => (
              <option key={id} value={`minecraft:${id}`} />
            ))}
          </datalist>
        </Panel>

        <Panel className="p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
            <Upload className="h-4 w-4" />
            IMPORT A MATERIAL LIST
          </p>
          <div className="mt-4">
            <ImportMaterialsForm projectId={project.id} />
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
          <FileBox className="h-4 w-4" />
          LITEMATICA FILES
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Upload schematics for this build — citizens can download them from the project
          page.
        </p>
        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f) => (
              <li key={f.id}>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileBox className="h-4 w-4 shrink-0 text-gold-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-200">
                        {f.file_name}
                      </p>
                      <p className="text-xs text-slate-600">{formatBytes(f.size_bytes)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={buildFileUrl(f.storage_path)}
                      download={f.file_name}
                      className="pressable inline-flex items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:border-gold-500/50 hover:text-gold-300"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                    <RemoveItemButton
                      action={deleteBuildFile.bind(null, f.id, project.id)}
                      label={`Remove ${f.file_name}`}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 max-w-md">
          <UploadBuildFileForm projectId={project.id} />
        </div>
      </Panel>

      <Panel className="p-5">
        <p className="font-display text-sm font-bold tracking-widest text-gold-300">
          PROJECT DETAILS
        </p>
        <div className="mt-4 max-w-xl">
          <EditBuildProjectForm
            projectId={project.id}
            name={project.name}
            description={project.description}
            priority={project.priority}
          />
        </div>
      </Panel>
    </div>
  );
}
