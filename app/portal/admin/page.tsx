import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Check,
  ClipboardList,
  Compass,
  Hammer,
  ImageIcon,
  Lock,
  Newspaper,
  ScrollText,
  ShieldCheck,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { isVerifyCommandRegistered } from "@/lib/discord";
import { approvePlayer } from "@/actions/admin";
import { GoldDivider, Panel, cardLinkClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { RegisterCommandButton } from "@/components/admin/RegisterCommandButton";

export const metadata: Metadata = { title: "Admin - Whitelisting Queue" };

export default async function AdminPage() {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const { data: queue, error } = await getSupabase()
    .from("players")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<Player[]>();

  if (error) {
    throw new Error(`Failed to load the whitelisting queue: ${error.message}`);
  }

  // One-time setup: hide the installer once /verify exists. Fail OPEN - if the
  // check errors, show it, since that's exactly when you'd need to run it.
  let verifyInstalled = false;
  try {
    verifyInstalled = await isVerifyCommandRegistered();
  } catch (err) {
    console.error("Could not check /verify registration:", err);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          THE GREAT HALL
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Whitelisting Queue
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {queue.length === 0
            ? "No petitions await."
            : `${queue.length} petition${queue.length === 1 ? "" : "s"} await the council's word.`}{" "}
          Discord-linked applicants receive the @Citizen role automatically on approval.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/portal/admin/teams" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-5`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                TEAMS
              </p>
              <p className="mt-1 text-sm text-slate-400">Guilds & Discord roles.</p>
            </div>
            <Swords className="h-5 w-5 shrink-0 text-gold-400" />
          </Panel>
        </Link>
        <Link href="/portal/admin/tasks" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-5`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                THE LEDGER
              </p>
              <p className="mt-1 text-sm text-slate-400">Assign duties &amp; goals.</p>
            </div>
            <ClipboardList className="h-5 w-5 shrink-0 text-gold-400" />
          </Panel>
        </Link>
        <Link href="/portal/admin/builds" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-5`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                THE MASTER PLAN
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Plan builds against live stock.
              </p>
            </div>
            <Hammer className="h-5 w-5 shrink-0 text-gold-400" />
          </Panel>
        </Link>
        <Link href="/portal/admin/news" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-5`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                THE HERALD
              </p>
              <p className="mt-1 text-sm text-slate-400">Write news dispatches.</p>
            </div>
            <Newspaper className="h-5 w-5 shrink-0 text-gold-400" />
          </Panel>
        </Link>
        <Link href="/portal/admin/members" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-5`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                THE ROLL
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Every member - revoke or kick.
              </p>
            </div>
            <Users className="h-5 w-5 text-gold-400" />
          </Panel>
        </Link>
        <Link href="/portal/admin/showcase" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-5`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                GREAT WORKS
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Curate the public showcase.
              </p>
            </div>
            <ImageIcon className="h-5 w-5 text-gold-400" />
          </Panel>
        </Link>
        <Link href="/portal/admin/quiz" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-5`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                QUIZ ROLES
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Map alignments to teams.
              </p>
            </div>
            <Compass className="h-5 w-5 shrink-0 text-gold-400" />
          </Panel>
        </Link>
        <Link href="/portal/admin/funnel" className="block">
          <Panel className={`${cardLinkClass} flex items-center justify-between p-5`}>
            <div>
              <p className="font-display text-sm font-bold tracking-widest text-gold-300">
                THE FUNNEL
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Where recruits drop off.
              </p>
            </div>
            <TrendingUp className="h-5 w-5 shrink-0 text-gold-400" />
          </Panel>
        </Link>
      </div>

      {!verifyInstalled && (
        <Panel className="flex flex-col gap-3 border-amber-900/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-sm font-bold tracking-widest text-amber-300">
              SETUP - INSTALL /VERIFY
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Members prove a signup code with{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-gold-400">
                /verify
              </code>
              . Run this once; this panel disappears when it&apos;s installed.
            </p>
          </div>
          <RegisterCommandButton />
        </Panel>
      )}

      <GoldDivider />

      {queue.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <ShieldCheck className="h-8 w-8 text-gold-400" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            THE QUEUE STANDS EMPTY
          </p>
          <p className="text-sm text-slate-500">The nation rests easy tonight.</p>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {queue.map((applicant) => (
            <li key={applicant.id}>
              <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <p className="font-display text-lg font-bold tracking-wider text-slate-100">
                    {applicant.minecraft_ign}
                  </p>
                  <p className="text-sm text-slate-400">@{applicant.discord_username}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {applicant.discord_id ? (
                      <span className="rounded-full border border-indigo-500/40 bg-indigo-950/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                        Discord-linked
                      </span>
                    ) : (
                      <>
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
                          Manual signup
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <ScrollText className="h-3.5 w-3.5" />
                          Unverified - have them run{" "}
                          <code className="font-mono text-gold-400">
                            /verify {applicant.verification_code}
                          </code>{" "}
                          in Discord
                        </span>
                      </>
                    )}
                    <span className="text-xs text-slate-600">
                      Filed{" "}
                      {new Date(applicant.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                {applicant.discord_id ? (
                  <form action={approvePlayer.bind(null, applicant.id)} className="sm:w-44">
                    <SubmitButton>
                      <Check className="h-4 w-4" />
                      Approve
                    </SubmitButton>
                  </form>
                ) : (
                  <div
                    title="They must run /verify with their code before they can be approved."
                    className="inline-flex shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5 font-display text-sm font-bold tracking-wider text-slate-600 sm:w-44"
                  >
                    <Lock className="h-4 w-4" />
                    Awaiting /verify
                  </div>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
