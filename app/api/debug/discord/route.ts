import { NextResponse } from "next/server";

/**
 * TEMPORARY diagnostic — reports whether the Discord/Supabase config works,
 * WITHOUT exposing any secret values (only presence booleans + API status
 * codes). Delete this route once sign-in works.
 *
 * Visit: https://YOUR-DOMAIN/api/debug/discord
 */
export async function GET() {
  const API = "https://discord.com/api/v10";
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const roleId = process.env.DISCORD_CITIZEN_ROLE_ID;

  const report: Record<string, unknown> = {};

  // 1. Which env vars are present (booleans only — never the values).
  const vars = [
    "NEXT_PUBLIC_SITE_URL",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_BOT_TOKEN",
    "DISCORD_GUILD_ID",
    "DISCORD_CITIZEN_ROLE_ID",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SESSION_SECRET",
  ];
  report.envPresent = Object.fromEntries(
    vars.map((v) => [v, Boolean(process.env[v])])
  );
  report.siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? null;

  // 2. Is the bot token valid?
  try {
    const r = await fetch(`${API}/users/@me`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });
    const body = r.ok ? ((await r.json()) as { username?: string }) : null;
    report.botToken = {
      status: r.status,
      ok: r.ok,
      botUsername: body?.username ?? null,
      hint: r.ok
        ? "Bot token is valid."
        : "Bot token is WRONG or revoked (should be 200).",
    };
  } catch (e) {
    report.botToken = { error: String(e) };
  }

  // 3. Can the bot see the guild? (i.e. is it invited to your server?)
  try {
    const r = await fetch(`${API}/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });
    const body = r.ok ? ((await r.json()) as { name?: string }) : null;
    report.guildAccess = {
      status: r.status,
      ok: r.ok,
      guildName: body?.name ?? null,
      hint: r.ok
        ? "Bot is in the server and GUILD_ID is correct."
        : "Bot is NOT in this server, or GUILD_ID is wrong (403/404).",
    };
  } catch (e) {
    report.guildAccess = { error: String(e) };
  }

  // 4. Does the @Citizen role ID actually exist in that guild?
  try {
    const r = await fetch(`${API}/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });
    if (r.ok) {
      const roles = (await r.json()) as { id: string; name: string }[];
      const match = roles.find((role) => role.id === roleId);
      report.citizenRole = {
        found: Boolean(match),
        roleName: match?.name ?? null,
        hint: match
          ? "CITIZEN_ROLE_ID matches a real role."
          : "CITIZEN_ROLE_ID does not match any role in this guild.",
      };
    } else {
      report.citizenRole = { status: r.status, ok: false };
    }
  } catch (e) {
    report.citizenRole = { error: String(e) };
  }

  return NextResponse.json(report, { status: 200 });
}
