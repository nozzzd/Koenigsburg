const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_CONTAINERS = 200;
const MAX_ITEMS = 8_000;

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function isConfigured(): boolean {
  return Boolean(
    process.env.QMSYNC_API_KEY?.trim() && process.env.QMSYNC_SERVER_ID?.trim()
  );
}

function originFor(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  return host ? `${forwardedProto}://${host}` : url.origin;
}

export function qmsyncHandshake(request: Request): Response {
  const serverId = process.env.QMSYNC_SERVER_ID?.trim() ?? null;
  const serverName =
    process.env.QMSYNC_SERVER_NAME?.trim() ?? serverId ?? "Koenigsburg";
  const origin = originFor(request);
  const syncUrl = `${origin}/api/inventory/sync`;

  return json({
    ok: true,
    status: "ok",
    configured: isConfigured(),
    service: "qmsync",
    type: "qmsync-handshake",
    apiVersion: 1,
    version: 1,
    protocolVersion: 1,
    protocolVersions: [1],
    serverId,
    serverName,
    name: serverName,
    syncUrl,
    url: syncUrl,
    endpoint: syncUrl,
    endpoints: {
      sync: syncUrl,
      legacySync: `${origin}/api/sync`,
    },
    auth: {
      schemes: ["Bearer", "x-qmsync-key"],
      header: "Authorization",
    },
    limits: {
      maxBodyBytes: MAX_BODY_BYTES,
      maxContainers: MAX_CONTAINERS,
      maxItems: MAX_ITEMS,
    },
  });
}

export function qmsyncHandshakeOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": "authorization,content-type,x-qmsync-key",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
