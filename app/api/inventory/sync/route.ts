import { handleQMSyncSync, qmsyncOptions } from "@/lib/qmsync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function POST(request: Request): Promise<Response> {
  return handleQMSyncSync(request);
}

export function OPTIONS(): Response {
  return qmsyncOptions();
}
