"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Download, Loader2, RotateCcw, Share2 } from "lucide-react";
import {
  ARCHETYPE_BY_KEY,
  type ArchetypeKey,
  type QuizResult as QuizResultData,
} from "@/lib/quiz";
import { downloadResultImage } from "@/lib/quizImage";
import { track } from "@/actions/funnel";
import { GoldDivider, Panel, heroCtaClass, outlineButtonClass } from "@/components/ui";
import { RadarChart } from "./RadarChart";

/**
 * The payoff screen: radar chart of all six axes, the winning archetype called
 * out, the top three with their blurbs, and the big Sign Up CTA. The CTA
 * carries only the archetype KEY in the URL (?role=builder) — the server
 * resolves that to a real team, so the client can never inject a team id.
 *
 * `mappedRoles` is the set of archetypes an admin has wired to a real team;
 * when the top role is one of them, the CTA copy invites the recruit to join
 * that team directly. Otherwise it's a plain "Sign Up Now".
 */
export function QuizResult({
  result,
  mappedRoles,
  onRetake,
}: {
  result: QuizResultData;
  mappedRoles: ArchetypeKey[];
  onRetake: () => void;
}) {
  const top = result.ranked[0];
  const topThree = result.ranked.slice(0, 3);
  const topArch = ARCHETYPE_BY_KEY[top];
  const topIsMapped = mappedRoles.includes(top);

  const [saving, setSaving] = useState(false);
  async function download() {
    setSaving(true);
    try {
      await downloadResultImage(result, top);
    } catch (err) {
      console.error("Could not build the result image:", err);
    } finally {
      setSaving(false);
    }
  }

  // Share the result to spread the quiz. Native share sheet on mobile, clipboard
  // copy on desktop. Either way it carries the quiz link, which is the loop.
  const [shared, setShared] = useState(false);
  async function share() {
    void track("quiz_share");
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/quiz`;
    const text = `I'm a ${topArch.label} in Königsburg! What role are you? Take the quiz: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Königsburg Alignment Quiz", text, url });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    } catch {
      // User dismissed the share sheet, or clipboard blocked — no-op.
    }
  }

  return (
    <div className="page-in space-y-8">
      <div className="text-center">
        <p className="font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          THE COUNCIL HAS WEIGHED YOU
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-wide text-slate-100 sm:text-4xl">
          You are a{" "}
          <span className="bg-gradient-to-b from-gold-200 to-gold-500 bg-clip-text text-transparent">
            {topArch.label}
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-balance text-sm text-slate-400">
          {topArch.blurb}
        </p>
      </div>

      <Panel className="p-6">
        <RadarChart scores={result.scores} />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={share}
            className={`${outlineButtonClass} !px-5 !py-2 !text-xs`}
          >
            {shared ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied! Paste it anywhere
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                Share your result
              </>
            )}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={saving}
            className={`${outlineButtonClass} !px-5 !py-2 !text-xs disabled:opacity-60`}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {saving ? "Preparing image…" : "Download image"}
          </button>
        </div>
      </Panel>

      <div>
        <p className="mb-3 text-center font-display text-xs font-semibold tracking-[0.35em] text-slate-500">
          YOUR TOP THREE CALLINGS
        </p>
        <div className="stagger grid gap-3 sm:grid-cols-3">
          {topThree.map((key, i) => {
            const a = ARCHETYPE_BY_KEY[key];
            return (
              <Panel key={key} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-500/40 font-display text-xs font-bold text-gold-300">
                    {i + 1}
                  </span>
                  <p className="font-display text-sm font-bold tracking-wide text-slate-100">
                    {a.label}
                  </p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{a.blurb}</p>
              </Panel>
            );
          })}
        </div>
      </div>

      <GoldDivider />

      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          YOUR PLACE IS WAITING
        </p>
        {topIsMapped ? (
          <>
            <p className="max-w-md text-balance text-slate-300">
              Königsburg needs {topArch.label}s. Don&apos;t just read your result, live it. Swear
              in now and join the{" "}
              <span className="font-semibold text-gold-300">{topArch.label}s</span> before your
              spot fills.
            </p>
            <Link href={`/apply?role=${top}`} className={heroCtaClass}>
              Claim your place as a {topArch.label}
            </Link>
            <Link
              href="/apply"
              className="text-sm font-semibold text-slate-500 underline-offset-4 transition hover:text-gold-300 hover:underline"
            >
              Or just sign up normally
            </Link>
          </>
        ) : (
          <>
            <p className="max-w-md text-balance text-slate-300">
              You know your calling. Now claim it. The gates of Königsburg are open, and founding
              {" "}
              {topArch.label}s are being sworn in right now.
            </p>
            <Link href="/apply" className={heroCtaClass}>
              Claim your place in Königsburg
            </Link>
          </>
        )}

        <button
          type="button"
          onClick={onRetake}
          className={`${outlineButtonClass} mt-2 !px-5 !py-2 !text-xs`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retake the quiz
        </button>
      </div>
    </div>
  );
}
