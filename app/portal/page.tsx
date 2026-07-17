import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Crown,
  KeyRound,
  ShieldCheck,
  Swords,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { GoldDivider, Panel } from "@/components/ui";
import { SaveKeyWarning } from "@/components/SaveKeyWarning";
import { CopyCode } from "@/components/CopyCode";
import { LeaveForm } from "@/components/forms/LeaveForm";

export const metadata: Metadata = { title: "Citizen's Hall" };

const ROLE_LABELS = { guest: "Guest", citizen: "Citizen", admin: "Council Elder" } as const;

export default async function PortalPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  const memberSince = new Date(player.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const facts = [
    { icon: Swords, label: "Minecraft Name", value: player.minecraft_ign },
    { icon: Crown, label: "Rank", value: ROLE_LABELS[player.role] },
    { icon: ShieldCheck, label: "Standing", value: "Active — Whitelisted" },
    { icon: CalendarDays, label: "Sworn In", value: memberSince },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          THE CITIZEN&apos;S HALL
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Hail, {player.minecraft_ign}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
          <UserRound className="h-4 w-4 text-slate-500" />@{player.discord_username}
        </p>
      </div>

      {!player.key_saved && <SaveKeyWarning code={player.verification_code} />}

      <GoldDivider />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(({ icon: Icon, label, value }) => (
          <Panel key={label} className="p-5">
            <Icon className="h-5 w-5 text-gold-400" strokeWidth={1.5} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="mt-1 truncate font-semibold text-slate-100" title={value}>
              {value}
            </p>
          </Panel>
        ))}
      </div>

      {player.role === "admin" && (
        <Link href="/portal/admin" className="block">
          <Panel className="flex items-center justify-between p-6 transition hover:border-gold-500/50">
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                ADMIN CONTROL PANEL
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Review the whitelisting queue and curate the Great Works.
              </p>
            </div>
            <Crown className="h-6 w-6 text-gold-400" />
          </Panel>
        </Link>
      )}

      <Panel className="space-y-4 p-6">
        <p className="font-display text-xs font-semibold tracking-[0.3em] text-slate-500">
          SETTINGS
        </p>

        {/* The key is a secret — kept behind a toggle rather than sat on screen. */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-gold-500/50 hover:text-gold-300 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gold-400" />
              Show my login key
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 pt-4">
            <CopyCode code={player.verification_code} />
            <p className="text-sm leading-relaxed text-slate-400">
              If your session is lost or you change devices, enter the gates again
              with your Minecraft name and this key. Guard it well —{" "}
              <span className="text-slate-200">anyone holding it can enter as you</span>.
            </p>
          </div>
        </details>

        {/* Destructive — small, right-aligned, and armed only by typing the IGN. */}
        <details className="group border-t border-slate-800/80 pt-4">
          <summary className="ml-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-red-900 hover:text-red-300 [&::-webkit-details-marker]:hidden">
            <span>Leave Königsburg</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 pt-4">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>
                Leaving erases your record and strips your{" "}
                <span className="text-slate-200">@Citizen</span> role in Discord.
                Your Minecraft name and key are released. This cannot be undone —
                you would have to petition the council anew.
              </span>
            </p>
            <LeaveForm ign={player.minecraft_ign} />
          </div>
        </details>
      </Panel>
    </div>
  );
}
