import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam === "access_denied") {
    return NextResponse.redirect(new URL("/?oura=denied", appUrl));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?oura=error", appUrl));
  }

  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?oura=config_error", appUrl));
  }

  const oauthState = await prisma.oAuthState.findUnique({
    where: { state },
  });

  if (!oauthState || new Date() > oauthState.expiresAt) {
    return NextResponse.redirect(new URL("/?oura=invalid_state", appUrl));
  }

  const redirectUri = `${appUrl}/api/oura/callback`;

  const tokenRes = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("Oura token exchange failed:", tokenRes.status, errText);
    return NextResponse.redirect(new URL("/?oura=token_error", appUrl));
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.user.upsert({
    where: { id: oauthState.userId },
    create: {
      id: oauthState.userId,
      ouraAccessToken: tokens.access_token,
      ouraRefreshToken: tokens.refresh_token,
      ouraTokenExpiresAt: expiresAt,
    },
    update: {
      ouraAccessToken: tokens.access_token,
      ouraRefreshToken: tokens.refresh_token,
      ouraTokenExpiresAt: expiresAt,
    },
  });

  await prisma.oAuthState.delete({ where: { state } });

  return NextResponse.redirect(new URL("/?oura=connected", appUrl));
}
