import { getSessionPlayer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/** Lightweight target for the portal's idle-session citizenship watcher. */
export async function GET() {
  const player = await getSessionPlayer();
  if (!player) {
    return Response.json({ active: false }, { status: 401, headers });
  }
  if (player.status !== "active") {
    return Response.json(
      { active: false, revoked: player.citizenshipRevoked === true },
      { status: 403, headers }
    );
  }
  return Response.json({ active: true }, { headers });
}
