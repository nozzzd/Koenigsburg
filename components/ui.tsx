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

/** Ornamental horizontal rule: line — diamond — line. */
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
    <Link href={href} className="group flex items-center gap-3">
      <Crest className="h-9 w-9" />
      <span className="font-display text-lg font-semibold tracking-[0.2em] text-slate-100 transition group-hover:text-gold-300">
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

export const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-400/25";

export const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400";

export const goldButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-2.5 font-display text-sm font-bold tracking-wider text-slate-950 transition hover:from-gold-200 hover:to-gold-400 disabled:cursor-not-allowed disabled:opacity-60";

export const outlineButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gold-500/40 px-4 py-2.5 font-display text-sm font-bold tracking-wider text-gold-300 transition hover:border-gold-400 hover:bg-gold-400/10";
