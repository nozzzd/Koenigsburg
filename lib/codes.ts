import { randomInt } from "crypto";

// No 0/O/1/I/L — codes get read aloud and retyped in Discord.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export const CODE_PREFIX = "KBRG-";

/** e.g. KBRG-7XKQ2M9A — the player's permanent re-login key. */
export function generateVerificationCode(): string {
  let body = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    body += ALPHABET[randomInt(ALPHABET.length)];
  }
  return CODE_PREFIX + body;
}
