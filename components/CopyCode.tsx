"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the code is visible for manual copying.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gold-500/40 bg-slate-950/80 px-4 py-3">
      <code className="font-mono text-lg font-semibold tracking-widest text-gold-300">
        {code}
      </code>
      <button
        type="button"
        onClick={copy}
        className="pressable inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-gold-400 hover:text-gold-300"
        aria-label="Copy verification code"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
