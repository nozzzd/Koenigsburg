import { POST as inventorySyncPost } from "../inventory/sync/route";
import { qmsyncHandshake, qmsyncHandshakeOptions } from "@/lib/qmsyncHandshake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return qmsyncHandshake(request);
}

export function POST(request: Request): Promise<Response> {
  return inventorySyncPost(request);
}

export function OPTIONS(): Response {
  return qmsyncHandshakeOptions();
}
