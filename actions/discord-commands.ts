"use server";

import { env } from "@/lib/env";
import { getSessionPlayer } from "@/lib/session";
import type { ResultState } from "@/lib/forms";

/**
 * Registers /verify as a GUILD command (instant, unlike global commands which
 * take up to an hour to propagate). Admin-only; run once, and again whenever
 * the command definition changes.
 */
export async function registerDiscordCommands(): Promise<ResultState> {
  const admin = await getSessionPlayer();
  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    return { error: "Not authorized." };
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/applications/${env("DISCORD_CLIENT_ID")}/guilds/${env(
        "DISCORD_GUILD_ID"
      )}/commands`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            name: "verify",
            description: "Prove a Königsburg signup code belongs to you",
            options: [
              {
                name: "code",
                description: "The KBRG- code from your signup page",
                type: 3, // STRING
                required: true,
              },
            ],
          },
        ]),
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("Command registration failed:", res.status, detail);
      return { error: `Discord rejected it (${res.status}). ${detail.slice(0, 160)}` };
    }

    return { ok: "/verify is registered — try it in your Discord server." };
  } catch (err) {
    console.error("Command registration threw:", err);
    return { error: "Could not reach Discord. Check the bot token and try again." };
  }
}
