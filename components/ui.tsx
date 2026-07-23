import type { ReactNode } from "react";
import Link from "next/link";
import { Castle } from "lucide-react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/40 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

/** Ornamental horizontal rule: line - diamond - line. */
export function GoldDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/50" />
      <div className="h-1.5 w-1.5 rotate-45 bg-gold-400" />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/50" />
    </div>
  );
}

export function Crest({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full border border-gold-500/40 bg-gradient-to-b from-slate-800 to-slate-950 text-gold-400 shadow-lg shadow-black/50 ${className}`}
    >
      <Castle className="h-1/2 w-1/2" strokeWidth={1.5} />
    </div>
  );
}

export function WordMark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group flex shrink-0 items-center gap-2 sm:gap-3">
      <Crest className="h-8 w-8 sm:h-9 sm:w-9" />
      {/* Tighter on phones - the full-size mark plus nav overflows a 320px screen. */}
      <span className="font-display text-sm font-semibold tracking-[0.12em] text-slate-100 transition group-hover:text-gold-300 sm:text-lg sm:tracking-[0.2em]">
        KÖNIGSBURG
      </span>
    </Link>
  );
}

/** Centered single-column page (login, apply, pending, welcome). */
export function GateShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-red-300"
    >
      {message}
    </p>
  );
}

/**
 * The header frame. Deliberately narrower than the hall body so the nav
 * buttons stay in from the edge of a wide monitor - the Herald is allowed to
 * reach further left than this.
 */
export const SHELL = "mx-auto w-full max-w-[100rem]";

/**
 * The Citizen's Hall body. Wider than the header so the Herald can push out
 * into the left gutter while the middle column stays screen-centred.
 */
export const HALL_SHELL = "mx-auto w-full max-w-[120rem]";

export const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-400/25";

export const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400";

export const goldButtonClass =
  "btn-gold pressable inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-display text-sm font-bold tracking-wider disabled:cursor-not-allowed disabled:opacity-60";

export const outlineButtonClass =
  "pressable inline-flex items-center justify-center gap-2 rounded-lg border border-gold-500/40 px-4 py-2.5 font-display text-sm font-bold tracking-wider text-gold-300 hover:border-gold-400 hover:bg-gold-400/10";

/** Oversized primary call-to-action - the single dominant "join" button. */
export const heroCtaClass =
  "btn-gold pressable inline-flex items-center justify-center gap-2.5 rounded-xl px-10 py-4 font-display text-base font-bold tracking-widest shadow-lg shadow-gold-500/20 hover:shadow-xl hover:shadow-gold-500/30";

/**
 * Header / secondary buttons. Carries a visible border and fill at rest so it
 * reads as a button before you hover it, then fills in on hover.
 */
export const navButtonClass =
  "pressable inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-sm font-semibold text-slate-400 hover:border-gold-500/50 hover:bg-slate-800 hover:text-gold-300 sm:px-3";

/** Panels that are links - lift and lighten so they feel clickable. */
export const cardLinkClass =
  "pressable h-full hover:border-gold-500/50 hover:bg-slate-800/50 hover:shadow-xl hover:shadow-black/50";
