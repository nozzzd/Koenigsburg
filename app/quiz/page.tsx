import type { Metadata } from "next";
import Link from "next/link";
import { getMappedRoles } from "@/actions/quiz";
import { WordMark, outlineButtonClass } from "@/components/ui";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { Quiz } from "@/components/quiz/Quiz";
import { FunnelBeacon } from "@/components/FunnelBeacon";

export const metadata: Metadata = {
  title: "Role Alignment Quiz",
  description:
    "Answer sixteen questions and discover the role you would hold in the nation of Königsburg.",
};

export default async function QuizPage() {
  // Which archetypes an admin has wired to a real team - decides whether the
  // result screen offers "Sign up as a Builder" or a plain signup.
  const mappedRoles = await getMappedRoles();

  return (
    <>
      <FunnelBeacon event="quiz_start" />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <WordMark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggleButton />
          <Link href="/login" className={outlineButtonClass}>
            Enter
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Quiz mappedRoles={mappedRoles} />
      </main>
    </>
  );
}
