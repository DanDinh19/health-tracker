import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const OURA_BASE = "https://api.ouraring.com/v2/usercollection";

// Prevent concurrent token refreshes (Oura refresh tokens are single-use)
const refreshLocks = new Map<string, Promise<string | null>>();

async function refreshOuraToken(userId: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    console.error("Oura token refresh failed:", res.status, await res.text());
    return null;
  }

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: {
      ouraAccessToken: tokens.access_token,
      ouraRefreshToken: tokens.refresh_token,
      ouraTokenExpiresAt: expiresAt,
    },
  });
  return tokens.access_token;
}

async function clearOuraTokens(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ouraAccessToken: null,
      ouraRefreshToken: null,
      ouraTokenExpiresAt: null,
    },
  });
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user.id;
}

export async function getOuraAccessToken(): Promise<{ token: string; userId: string } | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });
  if (!dbUser?.ouraAccessToken) return null;

  let token = dbUser.ouraAccessToken;
  if (dbUser.ouraTokenExpiresAt && new Date() > dbUser.ouraTokenExpiresAt && dbUser.ouraRefreshToken) {
    // Serialize refresh per user - Oura refresh tokens are single-use
    let refreshPromise = refreshLocks.get(user.id);
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          return await refreshOuraToken(user.id, dbUser!.ouraRefreshToken!);
        } finally {
          refreshLocks.delete(user.id);
        }
      })();
      refreshLocks.set(user.id, refreshPromise);
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      token = refreshed;
    } else {
      await clearOuraTokens(user.id);
      return null;
    }
  }
  return { token, userId: user.id };
}

export async function fetchOura<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const auth = await getOuraAccessToken();
  if (!auth) throw new Error("Not signed in or Oura not connected");

  const qs = new URLSearchParams(params).toString();
  const url = `${OURA_BASE}/${endpoint}?${qs}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (res.status === 401) {
    await clearOuraTokens(auth.userId);
    throw new Error("Oura token expired or invalid. Please reconnect your ring.");
  }
  if (!res.ok) throw new Error(`Oura API error: ${res.status}`);
  return res.json();
}
