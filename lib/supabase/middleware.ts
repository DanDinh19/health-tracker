import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

      const isLoginPage = request.nextUrl.pathname === "/login";
    const isAuthCallback = request.nextUrl.pathname.startsWith("/api/oura/callback");
    const isOuraConnect = request.nextUrl.pathname === "/api/oura/connect";
    const isStatic = request.nextUrl.pathname.startsWith("/_next") || request.nextUrl.pathname.includes(".");

    if (isLoginPage) {
      if (user) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return supabaseResponse;
    }

    if (!isAuthCallback && !isOuraConnect && !isStatic && !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
  } catch (err) {
    console.error("Middleware error:", err);
    return NextResponse.next({ request });
  }
}
