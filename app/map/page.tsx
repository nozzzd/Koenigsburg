import type { Metadata } from "next";
import Link from "next/link";
import { Map as MapIcon, Compass } from "lucide-react";
import {
  getSupabase,
  MAP_TILES_BUCKET,
  type MapTile,
} from "@/lib/supabase";
import {
  Crest,
  GoldDivider,
  Panel,
  WordMark,
  goldButtonClass,
  outlineButtonClass,
} from "@/components/ui";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { MapCanvas, type DisplayTile } from "@/components/map/MapCanvas";
import { DownloadMapButton } from "@/components/map/DownloadMapButton";

// Regenerated when a contributor uploads (revalidatePath('/map') in actions/map.ts);
// this is the safety-net refresh in case that ever misses.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Map",
  description:
    "The known world of Königsburg — charted region by region from our citizens' own explorations. Add the lands you've discovered.",
};

/** Reads every charted region and resolves each to a public tile URL. */
async function getTiles(): Promise<DisplayTile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("map_tiles")
    .select("*")
    .eq("dimension", "overworld")
    .returns<MapTile[]>();

  if (error) {
    // Table/bucket not created yet (migration 010 not run) — show the empty
    // state instead of crashing the public page.
    console.error("Failed to load map tiles:", error);
    return [];
  }

  return (data ?? []).map((t) => ({
    rx: t.region_x,
    rz: t.region_z,
    ign: t.contributor_ign,
    url: supabase.storage.from(MAP_TILES_BUCKET).getPublicUrl(t.storage_path).data.publicUrl,
  }));
}

export default async function MapPage() {
  const tiles = await getTiles();

  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <WordMark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggleButton />
          <Link href="/login" className={outlineButtonClass}>
            Enter
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 sm:px-6">
        <section className="flex flex-col items-center pt-10 pb-8 text-center sm:pt-12">
          <Crest className="h-14 w-14 sm:h-16 sm:w-16" />
          <p className="mt-5 font-display text-[0.65rem] font-semibold tracking-[0.3em] text-gold-500 sm:mt-6 sm:text-xs sm:tracking-[0.5em]">
            THE KNOWN WORLD OF
          </p>
          <h1 className="mt-3 bg-gradient-to-b from-slate-50 via-slate-200 to-slate-400 bg-clip-text font-display text-[1.75rem] font-bold tracking-[0.06em] text-transparent sm:text-5xl sm:tracking-[0.15em] lg:text-6xl">
            KÖNIGSBURG
          </h1>
          <p className="mt-5 max-w-xl text-balance text-slate-400">
            Charted region by region from our own citizens&apos; explorations. Every
            tile is the newest scouting we have — the frontier fills in as more of
            us venture out.
          </p>
        </section>

        <GoldDivider className="w-full max-w-3xl" />

        {tiles.length === 0 ? (
          <section className="w-full py-16">
            <Panel className="flex flex-col items-center gap-3 p-12 text-center">
              <Compass className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
              <p className="font-display text-sm font-bold tracking-widest text-slate-300">
                THE MAP IS BEING SURVEYED
              </p>
              <p className="max-w-sm text-sm text-slate-500">
                No lands have been charted yet. Be the first cartographer — upload a
                slice of your Xaero map and put Königsburg on the map.
              </p>
              <Link href="/map/contribute" className={`${goldButtonClass} mt-2 sm:w-auto`}>
                <MapIcon className="h-4 w-4" />
                Contribute a piece
              </Link>
            </Panel>
          </section>
        ) : (
          <section className="w-full space-y-5 py-10">
            <MapCanvas tiles={tiles} />
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <DownloadMapButton tiles={tiles} />
              <Link href="/map/contribute" className={`${goldButtonClass} sm:w-auto`}>
                <MapIcon className="h-4 w-4" />
                Contribute a piece
              </Link>
            </div>
          </section>
        )}
      </main>

      <footer className="pb-8 text-center text-xs tracking-widest text-slate-600">
        KÖNIGSBURG · EST. MMXXVI
      </footer>
    </>
  );
}
