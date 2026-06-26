import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check: presence of the session cookie only (edge-safe, no DB or
// self-fetch). Pages that need the real session validate it server-side.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except the auth endpoints, the sign-in page, the
  // OAuth error page, and Next internals / static assets.
  matcher: [
    "/((?!api/auth|sign-in|auth/error|_next/static|_next/image|favicon.ico).*)",
  ],
};
