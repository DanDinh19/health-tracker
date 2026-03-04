import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_SCOPES = ["email", "personal", "daily", "heartrate", "workout", "tag", "session", "spo2"].join(" ");

export async function GET() {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Oura OAuth not configured. Set OURA_CLIENT_ID and OURA_CLIENT_SECRET." },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      const loginUrl = new URL("/login", appUrl);
      loginUrl.searchParams.set("redirect", "/api/oura/connect");
      if (error?.message?.includes("something went wrong") || error?.message?.includes("prxiYo6u")) {
        loginUrl.searchParams.set("error", "supabase_unavailable");
      }
      return NextResponse.redirect(loginUrl);
    }

    const state = randomBytes(32).toString("hex");
    const redirectUri = `${appUrl}/api/oura/callback`;

    await prisma.oAuthState.create({
      data: {
        state,
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: OURA_SCOPES,
      state,
    });

    return NextResponse.redirect(`${OURA_AUTHORIZE_URL}?${params.toString()}`);
  } catch (err) {
    console.error("Oura connect error:", err);
    const loginUrl = new URL("/login", appUrl);
    loginUrl.searchParams.set("redirect", "/api/oura/connect");
    loginUrl.searchParams.set("error", "supabase_unavailable");
    return NextResponse.redirect(loginUrl);
  }
}
