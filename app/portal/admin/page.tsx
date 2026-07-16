import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, ScrollText, ShieldCheck } from "lucide-react";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { approvePlayer } from "@/actions/admin";
import { GoldDivider, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata: Metadata = { title: "Admin — Whitelisting Queue" };

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

      <GoldDivider />

      {queue.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <ShieldCheck className="h-8 w-8 text-gold-400" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            THE QUEUE STANDS EMPTY
          </p>
          <p className="text-sm text-slate-500">The realm rests easy tonight.</p>
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
                          Verify in #immigration:{" "}
                          <code className="font-mono text-gold-400">
                            {applicant.verification_code}
                          </code>
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
                <form action={approvePlayer.bind(null, applicant.id)} className="sm:w-44">
                  <SubmitButton>
                    <Check className="h-4 w-4" />
                    Approve
                  </SubmitButton>
                </form>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
