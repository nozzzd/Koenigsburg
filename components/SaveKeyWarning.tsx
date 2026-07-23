import { KeyRound, TriangleAlert } from "lucide-react";
import { acknowledgeKey } from "@/actions/account";
import { CopyCode } from "@/components/CopyCode";
import { Panel, goldButtonClass } from "@/components/ui";

/**
 * Shown once, after approval, when the member is issued their private login
 * key. They must confirm they've saved it before it disappears from view.
 */
export function SaveKeyWarning({ code }: { code: string }) {
  return (
    <Panel className="border-gold-500/50 bg-gold-400/[0.03] p-6">
      <p className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-gold-300">
        <TriangleAlert className="h-4 w-4" />
        SAVE YOUR LOGIN KEY
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        This is your <span className="font-semibold text-gold-300">private key</span> to
        Königsburg. You need it to sign in if you clear cookies or switch devices -
        there is no email recovery.
      </p>
      <div className="mt-4">
        <CopyCode code={code} />
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
        <li className="flex items-start gap-2">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
          Write it down somewhere safe.
        </li>
        <li className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <span>
            <span className="font-semibold text-red-300">Never share it</span> - anyone
            holding it can sign in as you. If you posted an older code in
            #immigration, that one is now dead; delete the message.
          </span>
        </li>
      </ul>
      <form action={acknowledgeKey} className="mt-5">
        <button type="submit" className={goldButtonClass}>
          I have saved my key
        </button>
      </form>
      <p className="mt-2 text-center text-xs text-slate-600">
        You can always find it again under Settings.
      </p>
    </Panel>
  );
}
