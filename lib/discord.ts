import "server-only";
import { env } from "./env";

const API = "https://discord.com/api/v10";

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
}

export function oauthRedirectUri(): string {
  return `${env("NEXT_PUBLIC_SITE_URL")}/api/auth/discord/callback`;
}

export function oauthAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("DISCORD_CLIENT_ID"),
    response_type: "code",
    redirect_uri: oauthRedirectUri(),
    scope: "identify",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("DISCORD_CLIENT_ID"),
      client_secret: env("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: oauthRedirectUri(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Discord token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Discord /users/@me failed (${res.status})`);
  }
  return (await res.json()) as DiscordUser;
}

/** Role IDs of the guild member, or null if they aren't in the guild. */
export async function getGuildMemberRoles(discordUserId: string): Promise<string[] | null> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/members/${discordUserId}`,
    {
      headers: { Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}` },
      cache: "no-store",
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Discord guild member lookup failed (${res.status})`);
  }
  const member = (await res.json()) as { roles?: string[] };
  return member.roles ?? [];
}

export async function hasCitizenRole(discordUserId: string): Promise<boolean> {
  const roles = await getGuildMemberRoles(discordUserId);
  return roles?.includes(env("DISCORD_CITIZEN_ROLE_ID")) ?? false;
}

/**
 * Assigns @Citizen via the bot. Requires Manage Roles and the bot's role
 * to sit above @Citizen in the guild's role hierarchy.
 */
export async function assignCitizenRole(discordUserId: string): Promise<void> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/members/${discordUserId}/roles/${env(
      "DISCORD_CITIZEN_ROLE_ID"
    )}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
        "X-Audit-Log-Reason": "Koenigsburg portal: application approved",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Discord role assignment failed (${res.status})`);
  }
}
