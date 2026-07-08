import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renamed the `middleware` file convention to `proxy` (same behaviour,
 * now on the Node.js runtime by default). This runs on every matched request:
 * it refreshes the Supabase auth session so the user stays logged in
 * indefinitely, and redirects anyone without a session to /login.
 */

// Routes reachable without a session. Everything else requires auth.
const PUBLIC_PATHS = ["/login"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  // This response is mutated by Supabase's setAll to carry refreshed cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: keep getUser() immediately after createServerClient — nothing in
  // between — so the token is refreshed on every request. This refresh is what
  // keeps the single owner logged in without re-prompting.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // No session and heading somewhere protected → send to login.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return copyCookies(response, NextResponse.redirect(url));
  }

  // Already signed in but sitting on /login → send into the app.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return copyCookies(response, NextResponse.redirect(url));
  }

  return response;
}

/** Preserve refreshed auth cookies when we return a brand-new redirect. */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export const config = {
  // Run on every path except Next internals and static image assets. The API
  // routes stay protected so they can't be hit without a session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
