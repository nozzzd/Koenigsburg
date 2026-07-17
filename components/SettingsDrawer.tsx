"use client";

import { useRef } from "react";
import { KeyRound, Palette, Settings, TriangleAlert, X } from "lucide-react";
import { CopyCode } from "@/components/CopyCode";
import { LeaveForm } from "@/components/forms/LeaveForm";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Settings as a right-hand slide-over, opened from the portal header.
 *
 * Uses a native <dialog> so Esc-to-close and focus trapping come for free;
 * clicking the backdrop closes it too.
 */
export function SettingsDrawer({ code, ign }: { code: string; ign: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Settings</span>
      </button>

      <dialog
        ref={ref}
        // A click that lands on the dialog itself (not the panel) is the backdrop.
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="drawer m-0 ml-auto h-dvh max-h-none w-full max-w-sm bg-transparent p-0 text-slate-200 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="drawer-content flex h-full flex-col overflow-y-auto border-l border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-bold tracking-[0.3em] text-gold-400">
              SETTINGS
            </p>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close settings"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-8 space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <Palette className="h-4 w-4 text-gold-400" />
              Appearance
            </p>
            <ThemeToggle />
          </div>

          <div className="mt-8 space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <KeyRound className="h-4 w-4 text-gold-400" />
              Your Login Key
            </p>
            <CopyCode code={code} />
            <p className="text-sm leading-relaxed text-slate-400">
              If your session is lost or you change devices, enter the gates again
              with your Minecraft name and this key. Guard it well —{" "}
              <span className="text-slate-200">anyone holding it can enter as you</span>.
            </p>
          </div>

          {/* Destructive — pushed to the very bottom, armed only by typing the IGN. */}
          <div className="mt-auto space-y-4 border-t border-slate-800 pt-6">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <span>
                Leaving erases your record and strips your{" "}
                <span className="text-slate-300">@Citizen</span> role in Discord.
                This cannot be undone — you would have to petition anew.
              </span>
            </p>
            <LeaveForm ign={ign} />
          </div>
        </div>
      </dialog>
    </>
  );
}
