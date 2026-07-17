import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronDown, KeyRound, TriangleAlert } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { GoldDivider, Panel } from "@/components/ui";
import { CopyCode } from "@/components/CopyCode";
import { LeaveForm } from "@/components/forms/LeaveForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the Citizen&apos;s Hall
        </Link>
        <p className="mt-4 font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          YOUR
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Settings
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Your key to the realm, and the door out of it.
        </p>
      </div>

      <GoldDivider />

      <Panel className="space-y-3 p-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <KeyRound className="h-4 w-4 text-gold-400" />
          Your Permanent Key
        </p>
        <CopyCode code={player.verification_code} />
        <p className="text-sm leading-relaxed text-slate-400">
          If your session is lost or you change devices, enter the gates again with
          your Minecraft name and this code. Guard it well —{" "}
          <span className="text-slate-200">anyone holding it can enter as you</span>.
        </p>
      </Panel>

      <Panel className="border-red-900/40 p-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-400">
          <TriangleAlert className="h-4 w-4" />
          Renounce Citizenship
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Leaving erases your record from the realm and strips your{" "}
          <span className="text-slate-200">@Citizen</span> role in Discord. Your
          Minecraft name and KBRG code are released. This cannot be undone — you
          would have to petition the council anew.
        </p>
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:border-red-900 hover:text-red-300 [&::-webkit-details-marker]:hidden">
            <span>Leave Königsburg</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pt-4">
            <LeaveForm />
          </div>
        </details>
      </Panel>
    </div>
  );
}
