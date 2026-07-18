import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import {
  Crest,
  GoldDivider,
  Panel,
  WordMark,
  outlineButtonClass,
} from "@/components/ui";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { TileUploader } from "@/components/map/TileUploader";

export const metadata: Metadata = {
  title: "Contribute to the Map",
  description:
    "Share the lands you've explored — export your Xaero's World Map and add your discoveries to Königsburg's community map.",
};

const steps: { title: string; body: string; caption: string }[] = [
  {
    title: "Open your world map in-game",
    body: "Join the server, then press M (the default key) to open Xaero's World Map. Pan around so the areas you've explored are loaded.",
    caption: "Xaero's World Map open in-game",
  },
  {
    title: "Export it to a PNG",
    body: "Click the settings/gear icon on the world map, then the \"Export to PNG\" button. Save the image somewhere you'll find it — your Desktop is fine.",
    caption: "The Export to PNG button in map settings",
  },
  {
    title: "Note the two corner coordinates",
    body: "Move your mouse to the TOP-LEFT corner of the exported area and write down the X and Z shown. Do the same for the BOTTOM-RIGHT corner. Those four numbers tell us where your map sits in the world.",
    caption: "Reading X / Z at a map corner",
  },
  {
    title: "Upload it here",
    body: "Below, pick your PNG, type in the four corner numbers, and hit upload. We automatically cut it into tiles and drop them onto the shared map. Newer uploads replace older ones for the same area.",
    caption: "The upload form on this page",
  },
];

export default async function ContributePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  return (
    <>
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <WordMark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggleButton />
          <Link href="/map" className={outlineButtonClass}>
            <ArrowLeft className="h-4 w-4" />
            Back to map
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-16 sm:px-6">
        <section className="flex flex-col items-center pt-8 pb-8 text-center">
          <Crest className="h-12 w-12" />
          <p className="mt-5 font-display text-[0.65rem] font-semibold tracking-[0.3em] text-gold-500 sm:text-xs sm:tracking-[0.5em]">
            CHART THE REALM
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-[0.08em] text-slate-100 sm:text-4xl">
            Add your discoveries
          </h1>
          <p className="mt-4 max-w-xl text-balance text-slate-400">
            Königsburg&apos;s map is built by its people. Export the world map you
            already have from Xaero&apos;s mod and we&apos;ll stitch your corner of
            the world into everyone&apos;s. It only takes a minute — no editing, no
            tech skills.
          </p>
        </section>

        <GoldDivider className="w-full" />

        {/* The guide — plain-language, screenshot slots fill in from /public/guide */}
        <section className="space-y-4 py-10">
          <h2 className="text-center font-display text-sm font-bold tracking-[0.3em] text-slate-300">
            HOW IT WORKS — FOUR STEPS
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((step, i) => (
              <Panel key={i} className="flex flex-col overflow-hidden">
                {/* Screenshot placeholder — drop an image at public/guide/step-N.png later */}
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 border-b border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-950 text-slate-600">
                  <ImageIcon className="h-7 w-7" strokeWidth={1.5} />
                  <span className="px-4 text-center text-[0.7rem] tracking-wide">{step.caption}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-500/40 font-display text-xs font-bold text-gold-300">
                      {i + 1}
                    </span>
                    <h3 className="font-display text-base font-bold tracking-wide text-slate-100">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{step.body}</p>
                </div>
              </Panel>
            ))}
          </div>
          <p className="mx-auto max-w-2xl rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-center text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-400">Why two corners?</span>{" "}
            Xaero shrinks large exports, so the image scale varies. The two corner
            coordinates let us line your map up exactly, whatever size it exported at.
          </p>
        </section>

        <GoldDivider className="w-full" />

        <section className="py-10">
          <Panel className="p-6 sm:p-8">
            <h2 className="mb-1 font-display text-lg font-bold tracking-wide text-slate-100">
              Upload your export
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              Signed in as <span className="text-gold-300">{player.minecraft_ign}</span>.
              Your name is credited on the tiles you add.
            </p>
            <TileUploader />
          </Panel>
        </section>
      </main>

      <footer className="pb-8 text-center text-xs tracking-widest text-slate-600">
        KÖNIGSBURG · EST. MMXXVI
      </footer>
    </>
  );
}
