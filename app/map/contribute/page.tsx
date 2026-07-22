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
import { RegionUploader } from "@/components/map/RegionUploader";

export const metadata: Metadata = {
  title: "Contribute to the Map",
  description:
    "Share the lands you've explored — export your Xaero's World Map and add your discoveries to Königsburg's community map.",
};

const steps: { title: string; body: string; caption: string }[] = [
  {
    title: "Find your Xaero map folder",
    body: "Press the Windows key + R, paste %appdata%\\.minecraft\\xaero\\world-map and hit Enter — the folder pops open. (Using CurseForge, Modrinth or Prism? Open your modpack's folder from the launcher instead, then go into xaero, then world-map.)",
    caption: "The world-map folder in Windows Explorer",
  },
  {
    title: "Select that folder below",
    body: "Scroll down, click \"Choose folder\" and pick the world-map folder you just found. Your browser may warn about \"uploading\" the folder — that's fine: everything is read on your own computer first.",
    caption: "Picking the world-map folder in the browser",
  },
  {
    title: "Check it found our server",
    body: "If you've played on several servers, pick ours from the list (we pre-select the world you played most recently). The name is the server address you use to join.",
    caption: "Choosing the right world",
  },
  {
    title: "Hit the button and watch",
    body: "Your browser draws map tiles straight from the mod's own files and uploads the finished pictures. You'll see your map appear as it goes. Every area carries the date you last saw it — the shared map always keeps the newest look at each area.",
    caption: "The map rendering in the browser",
  },
];

export default async function ContributePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");
  if (player.status !== "active") {
    redirect(player.citizenshipRevoked ? "/pending?revoked=1" : "/pending");
  }

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
            Königsburg&apos;s map is built by its people. Your Xaero mod already
            keeps a map of everything you&apos;ve explored — point us at its
            folder and we&apos;ll stitch your corner of the world into
            everyone&apos;s. It only takes a minute — no exporting, no
            coordinates, no tech skills.
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
            <span className="font-semibold text-slate-400">
              What actually gets uploaded?
            </span>{" "}
            Only finished map pictures — one small image per 512×512 area — plus
            the date each area was last seen. Your waypoints live in a different
            folder and are never touched. And because every area carries its own
            date, an old map can never overwrite someone&apos;s newer scouting.
          </p>
        </section>

        <GoldDivider className="w-full" />

        <section className="py-10">
          <Panel className="p-6 sm:p-8">
            <h2 className="mb-1 font-display text-lg font-bold tracking-wide text-slate-100">
              Share your map
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              Signed in as <span className="text-gold-300">{player.minecraft_ign}</span>.
              Your name is credited on the tiles you add.
            </p>
            <RegionUploader />
          </Panel>
        </section>
      </main>

      <footer className="pb-8 text-center text-xs tracking-widest text-slate-600">
        KÖNIGSBURG · EST. MMXXVI
      </footer>
    </>
  );
}
