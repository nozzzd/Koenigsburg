import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { oauthAuthorizeUrl } from "@/lib/discord";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(oauthAuthorizeUrl(state));
  res.cookies.set("kbg_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
