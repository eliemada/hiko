import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/** Optimistic check only — every page and action re-validates the session server-side. */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|vendor|icons|manifest.webmanifest|icon.svg|apple-icon.png|sign-in|sign-up|favicon.ico|.*\\.(?:png|svg|jpg|ico|webmanifest|mjs|js)$).*)"],
};
