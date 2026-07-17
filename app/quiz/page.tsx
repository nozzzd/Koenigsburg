import type { Metadata } from "next";
import Link from "next/link";
import { getMappedRoles } from "@/actions/quiz";
import { Crest, WordMark, outlineButtonClass } from "@/components/ui";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { Quiz } from "@/components/quiz/Quiz";

export const metadata: Metadata = {
  title: "Role Alignment Quiz",
  description:
    "Answer sixteen questions and discover the role you would hold in the nation of Königsburg.",
};

export default async function QuizPage() {
  // Which archetypes an admin has wired to a real team — decides whether the
  // result screen offers "Sign up as a Builder" or a plain signup.
  const mappedRoles = await getMappedRoles();

  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <WordMark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggleButton />
          <Link href="/login" className={outlineButtonClass}>
            Enter
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-16 sm:px-6">
        <section className="page-in flex flex-col items-center pt-6 pb-10 text-center sm:pt-12">
          <Crest className="h-14 w-14" />
          <p className="mt-6 font-display text-[0.65rem] font-semibold tracking-[0.35em] text-gold-500 sm:text-xs sm:tracking-[0.45em]">
            NATION ROLE
          </p>
          <h1 className="mt-2 bg-gradient-to-b from-slate-50 via-slate-200 to-slate-400 bg-clip-text font-display text-3xl font-bold tracking-[0.08em] text-transparent sm:text-4xl">
            ALIGNMENT QUIZ
          </h1>
          <p className="mt-4 max-w-md text-balance text-sm text-slate-400">
            Answer merely sixteen questions to see which role suits you best! Make sure to answer
            these questions truthfully, so we can assign you the best-suited role.
          </p>
        </section>

        <Quiz mappedRoles={mappedRoles} />
      </main>
    </>
  );
}
