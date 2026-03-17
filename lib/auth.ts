import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Resolves userId from request: X-API-Key (Apple Health) or Supabase session.
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const apiKey =
    request.headers.get("x-api-key") ?? request.nextUrl.searchParams.get("apiKey");
  if (apiKey) {
    const u = await prisma.user.findFirst({
      where: { appleHealthApiKey: apiKey },
      select: { id: true },
    });
    return u?.id ?? null;
  }
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : user.id;
}
