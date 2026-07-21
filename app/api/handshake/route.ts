import {
  handleQMSyncHandshake,
  qmsyncOptions,
} from "@/lib/qmsyncHandshake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleQMSyncHandshake(request);
}

export function OPTIONS(): Response {
  return qmsyncOptions();
}
