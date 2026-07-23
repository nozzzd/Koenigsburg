import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Compass, Database, Users } from "lucide-react";
import { getSupabase, type QuizRoleMap, type Team } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { GoldDivider, Panel } from "@/components/ui";
import { QuizRoleMapper } from "@/components/admin/QuizRoleMapper";

export const metadata: Metadata = { title: "Admin - Quiz Roles" };

export default async function AdminQuizPage() {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const supabase = getSupabase();
  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .order("name")
    .returns<Team[]>();

  const { data: mapRows, error: mapError } = await supabase
    .from("quiz_role_map")
    .select("archetype, team_id")
    .returns<Pick<QuizRoleMap, "archetype" | "team_id">[]>();

  // Either table missing => not migrated yet. Same graceful notice as Teams.
  if (teamsError || mapError) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold tracking-widest text-slate-100">
          Quiz Roles
        </h1>
        <Panel className="flex items-start gap-3 border-amber-900/50 p-6">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-amber-300">The quiz tables aren&apos;t ready yet.</p>
            <p className="text-slate-400">
              Run{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-400">
                supabase/006_teams.sql
              </code>{" "}
              and{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-400">
                supabase/007_quiz.sql
              </code>{" "}
              in the Supabase SQL Editor, then reload.
            </p>
            <p className="text-xs text-slate-600">
              Details: {(teamsError ?? mapError)?.message}
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  const teams = teamRows ?? [];
  const mapping: Record<string, string> = {};
  for (const row of mapRows ?? []) mapping[row.archetype] = row.team_id;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the Great Hall
        </Link>
        <p className="mt-4 flex items-center gap-2 font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          <Compass className="h-4 w-4" />
          THE ALIGNMENT QUIZ
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          Quiz Roles
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Wire each quiz alignment to a real team. When a recruit finishes the quiz and their top
          calling is mapped, their sign-up offers to join that team directly, applied when you
          approve them. Leave an alignment unmapped and it simply falls back to a normal signup.
        </p>
      </div>

      <GoldDivider />

      {teams.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <Users className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            NO TEAMS TO MAP TO
          </p>
          <p className="text-sm text-slate-500">
            Found a team first over on the{" "}
            <Link
              href="/portal/admin/teams"
              className="font-semibold text-gold-400 hover:text-gold-300"
            >
              Teams page
            </Link>
            , then come back to map the alignments.
          </p>
        </Panel>
      ) : (
        <Panel className="p-5">
          <QuizRoleMapper teams={teams} mapping={mapping} />
        </Panel>
      )}
    </div>
  );
}
