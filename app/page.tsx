import Link from "next/link";
import { Crown, Landmark, ScrollText } from "lucide-react";
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
import { SleepServersJoke } from "@/components/SleepServersJoke";

const pillars = [
  {
    icon: ScrollText,
    title: "Citizenship",
    text: "Petition through Discord or by written decree. Approved citizens are whitelisted on the server and welcomed within the walls.",
  },
  {
    icon: Landmark,
    title: "The Realm",
    text: "Claim land, raise keeps, and shape the districts of the free city — stone by stone, oath by oath.",
  },
  {
    icon: Crown,
    title: "The Council",
    text: "Every petition is weighed in the great hall. When the council approves, the gates open — no further ceremony required.",
  },
];

export default function LandingPage() {
  return (
    <>
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
            THE FREE CITY OF
          </p>
          {/* Tracking + size scale down hard on phones — at 5xl with 0.15em
              tracking this word is wider than a 375px viewport. */}
          <h1 className="mt-3 bg-gradient-to-b from-slate-50 via-slate-200 to-slate-400 bg-clip-text font-display text-[2rem] font-bold tracking-[0.06em] text-transparent sm:text-6xl sm:tracking-[0.15em] lg:text-7xl">
            KÖNIGSBURG
          </h1>
          <p className="mt-6 max-w-xl text-balance text-slate-400">
            A Minecraft civilization forged in stone and oath. Take the oath,
            earn your citizenship, and build your legacy within the walls.
          </p>
          <div className="mt-10 flex w-full max-w-xs flex-col items-stretch gap-3 sm:max-w-none sm:items-center sm:gap-4">
            <Link href="/login" className={heroCtaClass}>
              Enter the Gates
            </Link>
            <JoinDiscordButton />
          </div>
          <Link
            href="/showcase"
            className="mt-6 text-sm font-semibold text-slate-500 underline-offset-4 transition hover:text-gold-300 hover:underline"
          >
            Explore our Great Works →
          </Link>
        </section>

        <GoldDivider className="w-full max-w-3xl" />

        <section className="grid w-full max-w-5xl gap-4 py-14 sm:grid-cols-3">
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

        <SleepServersJoke />
      </main>

      <footer className="pb-8 text-center text-xs tracking-widest text-slate-600">
        KÖNIGSBURG · EST. MMXXVI
      </footer>
    </>
  );
}
