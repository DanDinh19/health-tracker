import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip middleware for static assets, ingest API (uses API key auth), and common paths
    "/((?!_next/static|_next/image|favicon.ico|api/apple-health/ingest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
