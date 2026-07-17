import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  Crown,
  KeyRound,
  ShieldCheck,
  Swords,
  UserRound,
} from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { GoldDivider, Panel } from "@/components/ui";
import { SaveKeyWarning } from "@/components/SaveKeyWarning";

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

      <Link href="/portal/settings" className="block">
        <Panel className="flex items-center justify-between p-5 transition hover:border-gold-500/50">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 shrink-0 text-gold-400" />
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-slate-200">
                SETTINGS
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                Your permanent key, and leaving the realm.
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </Panel>
      </Link>

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

    </div>
  );
}
