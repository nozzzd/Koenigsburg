"use client";

import { useMemo, useState } from "react";
import { QUESTIONS, scoreQuiz, type ArchetypeKey } from "@/lib/quiz";
import { track } from "@/actions/funnel";
import { Crest } from "@/components/ui";
import { QuizResult } from "./QuizResult";

/**
 * The quiz flow: one question at a time, four answer cards, a progress
 * footer. Picking an answer advances immediately; the last pick computes the
 * score and swaps in the result screen. Entirely client-side and anonymous —
 * nothing is written anywhere until the recruit chooses to sign up.
 */
export function Quiz({ mappedRoles }: { mappedRoles: ArchetypeKey[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => Array(QUESTIONS.length).fill(null)
  );
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  const result = useMemo(() => (done ? scoreQuiz(answers) : null), [done, answers]);

  function choose(answerIndex: number) {
    const next = [...answers];
    next[index] = answerIndex;
    setAnswers(next);
    if (index + 1 < QUESTIONS.length) {
      setIndex(index + 1);
    } else {
      setDone(true);
      void track("quiz_finish");
    }
  }

  function back() {
    if (index > 0) setIndex(index - 1);
  }

  function retake() {
    setAnswers(Array(QUESTIONS.length).fill(null));
    setIndex(0);
    setDone(false);
  }

  if (done && result) {
    return <QuizResult result={result} mappedRoles={mappedRoles} onRetake={retake} />;
  }

  const question = QUESTIONS[index];
  const progress = Math.round(((index + 1) / QUESTIONS.length) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Intro — only during the quiz; the result screen reclaims the space. */}
      <section className="page-in flex flex-col items-center pb-4 text-center">
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

      {/* Progress rail */}
      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          {index > 0 ? (
            <button
              type="button"
              onClick={back}
              className="text-xs font-semibold text-slate-500 transition hover:text-gold-300"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <p className="font-display text-xs font-semibold tracking-[0.35em] text-slate-500">
            {index + 1} / {QUESTIONS.length}
          </p>
        </div>
      </div>

      {/* One question — keyed so it re-animates on change */}
      <div key={question.id} className="page-in space-y-5">
        <h2 className="text-center font-display text-xl font-bold tracking-wide text-slate-100 sm:text-2xl">
          {question.prompt}
        </h2>
        <div className="stagger space-y-3">
          {question.answers.map((answer, i) => (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              className="pressable block w-full rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-left text-sm font-medium text-slate-300 hover:border-gold-500/50 hover:bg-slate-800/60 hover:text-slate-100"
            >
              {answer.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
