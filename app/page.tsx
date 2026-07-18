import Link from "next/link";
import {
  ClipboardList,
  Compass,
  Crown,
  Layers,
  Newspaper,
  Sparkles,
  Users,
} from "lucide-react";
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
    title: "Run like a real nation",
    text: "While other nations argue in a messy Discord, we have a citizenship roll, a role system, team guilds, and a council that actually plans. Order wins events.",
  },
  {
    icon: Sparkles,
    title: "Founding-member advantage",
    text: "The nation is being forged right now. Join today and you claim the best roles, shape the capital, and go down as one of the first names on the roll.",
  },
  {
    icon: Crown,
    title: "A role with your name on it",
    text: "You won't be a nobody grinding alone. Take the alignment quiz and the council gives you a real place: builder, fighter, gatherer, explorer, or statesman.",
  },
];

/** What the nation's organization actually gives a citizen — all true today. */
const benefits = [
  { icon: Layers, text: "Your own citizenship portal, not a lost role in a crowded Discord" },
  { icon: Compass, text: "A clear role and a team from day one, so you never grind alone" },
  { icon: ClipboardList, text: "A shared task ledger, so the whole nation knows the plan" },
  { icon: Crown, text: "A council that actually coordinates and leads, not chaos" },
  { icon: Newspaper, text: "In-nation dispatches that keep every citizen in the loop" },
  { icon: Users, text: "Founding-member standing while the best roles are still open" },
];

/** The three low-friction steps from stranger to citizen. */
const steps = [
  {
    title: "Sign in with Discord",
    text: "One click adds you straight to our server. No forms, no waiting.",
  },
  {
    title: "Get verified",
    text: "Prove your name in Discord and the council reviews your petition.",
  },
  {
    title: "Claim your role",
    text: "Take the quiz, get your calling, and start building your legacy.",
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
          <p className="mt-6 max-w-xl text-balance text-slate-300">
            Most players spend the event as nobodies, grinding alone. Not here. Königsburg gives
            you a role, a team, and a nation that has its act together before anyone else even
            has walls.
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

        <GoldDivider className="w-full max-w-3xl" />

        {/* What you actually get — tangible benefits sell harder than flavor. */}
        <section className="w-full max-w-4xl py-14">
          <div className="text-center">
            <p className="font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
              THE MOMENT YOU ARE SWORN IN
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-widest text-slate-100 sm:text-3xl">
              What every citizen gets
            </h2>
          </div>
          <ul className="stagger mt-8 grid gap-3 sm:grid-cols-2">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Panel className="flex items-center gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/30 bg-gold-400/5">
                    <Icon className="h-4 w-4 text-gold-400" strokeWidth={1.75} />
                  </span>
                  <span className="text-sm text-slate-300">{text}</span>
                </Panel>
              </li>
            ))}
          </ul>
        </section>

        <GoldDivider className="w-full max-w-3xl" />

        {/* Three steps kills the "is this a hassle?" hesitation. */}
        <section className="w-full max-w-5xl py-14">
          <div className="text-center">
            <p className="font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
              FROM STRANGER TO CITIZEN
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-widest text-slate-100 sm:text-3xl">
              Join in three steps
            </h2>
          </div>
          <ol className="stagger mt-8 grid gap-4 sm:grid-cols-3">
            {steps.map(({ title, text }, i) => (
              <li key={title}>
                <Panel className="h-full p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/40 font-display text-sm font-bold text-gold-300">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-display text-sm font-bold tracking-widest text-slate-100">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
                </Panel>
              </li>
            ))}
          </ol>
        </section>

        <GoldDivider className="w-full max-w-3xl" />

        {/* Closing ask — one last strong push to the gates. */}
        <section className="flex w-full max-w-3xl flex-col items-center py-16 text-center">
          <h2 className="font-display text-2xl font-bold tracking-widest text-slate-100 sm:text-3xl">
            The gates are open
          </h2>
          <p className="mt-4 max-w-lg text-balance text-slate-400">
            {count && count > 0
              ? `${count} have already sworn in. Founding roles are filling. Claim yours before someone else does.`
              : "Founding citizens are being sworn in now. Be one of the first names on the roll."}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/login" className={heroCtaClass}>
              Enter the Gates
            </Link>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 underline-offset-4 transition hover:text-gold-300 hover:underline"
            >
              <Compass className="h-4 w-4" />
              Not sure where you fit? Take the quiz
            </Link>
          </div>
        </section>
      </main>

      <footer className="pb-8 text-center text-xs tracking-widest text-slate-600">
        KÖNIGSBURG · EST. MMXXVI
      </footer>
    </>
  );
}
