import Link from "next/link";
import { Compass, Crown, Layers, Sparkles } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import {
  Crest,
  GoldDivider,
  Panel,
  WordMark,
  heroCtaClass,
  outlineButtonClass,
} from "@/components/ui";
import { JoinDiscordButton } from "@/components/DiscordButton";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { FunnelBeacon } from "@/components/FunnelBeacon";

// Keep the count fresh without hammering the DB on every hit.
export const revalidate = 60;

const pillars = [
  {
    icon: Layers,
    title: "Organized",
    text: "A real citizenship portal, role system, team guilds, and a shared task ledger. We run like an actual nation — not just another Discord.",
  },
  {
    icon: Sparkles,
    title: "Get in early",
    text: "We're still forging the nation. Founding citizens shape the districts, claim the best roles, and are remembered as the first through the gates.",
  },
  {
    icon: Crown,
    title: "A place for you",
    text: "Builder, fighter, gatherer, explorer, statesman — take the alignment quiz and the council finds where you belong. Everyone has a calling.",
  },
];

/** Live count of sworn citizens — social proof. Degrades to null on any error. */
async function citizenCount(): Promise<number | null> {
  try {
    const { count } = await getSupabase()
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    return count ?? null;
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const count = await citizenCount();

  return (
    <>
      <FunnelBeacon event="landing_view" />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <WordMark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/showcase"
            className="hidden text-sm font-semibold text-slate-300 transition hover:text-gold-300 sm:block"
          >
            Great Works
          </Link>
          <ThemeToggleButton />
          <Link href="/login" className={outlineButtonClass}>
            Enter
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 sm:px-6">
        <section className="flex flex-col items-center pt-12 pb-14 text-center sm:pt-24">
          <Crest className="h-16 w-16 sm:h-20 sm:w-20" />
          <p className="mt-6 font-display text-[0.65rem] font-semibold tracking-[0.35em] text-gold-500 sm:mt-8 sm:text-xs sm:tracking-[0.5em]">
            THE MOST ORGANIZED NATION IN THE EVENT
          </p>
          {/* Tracking + size scale down hard on phones — at 5xl with 0.15em
              tracking this word is wider than a 375px viewport. */}
          <h1 className="mt-3 bg-gradient-to-b from-slate-50 via-slate-200 to-slate-400 bg-clip-text font-display text-[2rem] font-bold tracking-[0.06em] text-transparent sm:text-6xl sm:tracking-[0.15em] lg:text-7xl">
            KÖNIGSBURG
          </h1>
          <p className="mt-6 max-w-xl text-balance text-slate-400">
            A civilization run like a real state, with citizenship, roles, and a council, all in
            place before the first stone is laid. Swear in now and help build it from the ground
            up.
          </p>

          {count !== null && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-400/5 px-4 py-1.5 text-xs font-semibold text-gold-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-400" />
              </span>
              {count === 0 ? (
                <>Be the first citizen of Königsburg</>
              ) : (
                <>
                  {count} sworn in. You&apos;d be founding citizen #{count + 1}
                </>
              )}
            </div>
          )}

          <div className="mt-8 flex w-full max-w-xs flex-col items-stretch gap-3 sm:max-w-none sm:items-center sm:gap-4">
            <Link href="/login" className={heroCtaClass}>
              Enter the Gates
            </Link>
            <JoinDiscordButton />
          </div>

          <Link
            href="/quiz"
            className={`${outlineButtonClass} mt-6 w-full max-w-xs sm:w-auto`}
          >
            <Compass className="h-4 w-4" />
            Which role suits you best? Take the Alignment Quiz!
          </Link>

          <Link
            href="/showcase"
            className="mt-5 text-sm font-semibold text-slate-500 underline-offset-4 transition hover:text-gold-300 hover:underline"
          >
            Explore our Great Works →
          </Link>
        </section>

        <GoldDivider className="w-full max-w-3xl" />

        <section className="stagger grid w-full max-w-5xl gap-4 py-14 sm:grid-cols-3">
          {pillars.map(({ icon: Icon, title, text }) => (
            <Panel key={title} className="p-6">
              <Icon className="h-6 w-6 text-gold-400" strokeWidth={1.5} />
              <h2 className="mt-4 font-display text-base font-bold tracking-widest text-slate-100">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
            </Panel>
          ))}
        </section>
      </main>

      <footer className="pb-8 text-center text-xs tracking-widest text-slate-600">
        KÖNIGSBURG · EST. MMXXVI
      </footer>
    </>
  );
}
