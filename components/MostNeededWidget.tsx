import { cache } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Database, PackageOpen } from "lucide-react";
import { getBuildOverview, type BuildOverview } from "@/lib/builds";
import { ItemIcon } from "@/components/ItemIcon";
import { Panel, navButtonClass } from "@/components/ui";

/**
 * The nation's biggest material gaps, straight from the build planner's shared
 * allocation. cache() dedupes so rendering the widget more than once per request
 * (e.g. desktop + mobile) still runs the query only once.
 */
const loadOverview = cache(function loadOverview(): Promise<BuildOverview> {
  return getBuildOverview();
});

function count(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

/**
 * A read-only board of the most-needed resources for every citizen.
 *   - unmigrated → hidden, unless the viewer is an admin (who gets a setup hint)
 *   - nothing short → a quiet "well supplied" note
 *   - otherwise → the largest gaps first
 */
export async function MostNeededWidget({
  isAdmin = false,
  limit = 8,
  className = "",
}: {
  isAdmin?: boolean;
  limit?: number;
  className?: string;
}) {
  const overview = await loadOverview();

  if (!overview.ready) {
    if (!isAdmin) return null;
    return (
      <Panel className={`overflow-hidden ${className}`}>
        <div className="flex items-center gap-2 border-b border-slate-800/80 px-5 py-4">
          <Boxes className="h-4 w-4 text-gold-400" />
          <p className="font-display text-xs font-bold tracking-[0.3em] text-gold-400">
            MOST NEEDED
          </p>
        </div>
        <div className="flex items-start gap-3 px-5 py-5 text-sm">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-slate-400">
            Run{" "}
            <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-gold-400">
              supabase/013_build_projects.sql
            </code>{" "}
            to switch on the build planner, then this board fills itself.
          </p>
        </div>
      </Panel>
    );
  }

  const shortfalls = overview.shortfalls.slice(0, limit);
  const extra = overview.shortfalls.length - shortfalls.length;
  const biggest = shortfalls[0]?.missing ?? 0;

  return (
    <Panel className={`overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-800/80 px-5 py-4">
        <Boxes className="h-4 w-4 text-gold-400" />
        <p className="font-display text-xs font-bold tracking-[0.3em] text-gold-400">
          MOST NEEDED
        </p>
      </div>

      {shortfalls.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <PackageOpen className="h-9 w-9 text-emerald-400" strokeWidth={1.25} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-400">
            WELL SUPPLIED
          </p>
          <p className="max-w-[16rem] text-sm text-slate-600">
            Every active build has the materials it needs. Nothing to gather.
          </p>
        </div>
      ) : (
        <>
          <p className="px-5 pt-4 text-xs text-slate-500">
            What the nation still needs across every active build - biggest gaps first.
          </p>
          <ul className="mt-3 divide-y divide-slate-800/70">
            {shortfalls.map((s) => {
              const width = biggest > 0 ? Math.max(4, Math.round((s.missing / biggest) * 100)) : 0;
              return (
                <li key={s.item_id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] mc-slot">
                    <ItemIcon
                      itemId={s.item_id}
                      label={s.display_name}
                      className="h-8 w-8"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {s.display_name}
                    </p>
                    <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-amber-500/70"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="font-display text-lg font-bold leading-none text-amber-300">
                      {count(s.missing)}
                    </span>
                    <span className="mt-0.5 block text-[0.6rem] uppercase tracking-widest text-slate-600">
                      short
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {extra > 0 && (
            <p className="px-5 py-2 text-xs text-slate-600">+{extra} more items short</p>
          )}
        </>
      )}

      <div className="mt-auto space-y-2 border-t border-slate-800/80 p-4">
        <Link href="/portal/builds" className={`${navButtonClass} w-full justify-center`}>
          See all builds
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {isAdmin && (
          <Link
            href="/portal/admin/builds"
            className={`${navButtonClass} w-full justify-center border-gold-500/40 text-gold-300`}
          >
            Open the Master Plan
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </Panel>
  );
}
