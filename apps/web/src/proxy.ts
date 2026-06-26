import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    try {
      const signInRes = await fetch(
        `${request.nextUrl.origin}/api/auth/sign-in/social`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "github",
            callbackURL: "/",
            disableRedirect: true,
          }),
        },
      );

      if (signInRes.ok) {
        const data = (await signInRes.json()) as { url?: string };
        if (data.url) {
          const redirect = NextResponse.redirect(data.url);
          // Better Auth sets a state cookie for CSRF verification on the
          // OAuth callback — forward it so the callback can validate it.
          for (const cookie of signInRes.headers.getSetCookie()) {
            redirect.headers.append("set-cookie", cookie);
          }
          return redirect;
        }
      }
    } catch {
      // fall through to error page
    }

    return NextResponse.redirect(new URL("/auth/error", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except the auth endpoints, the OAuth error page,
  // and Next internals / static assets. /sign-in is intentionally included
  // so the proxy can intercept it and redirect straight to GitHub OAuth.
  matcher: [
    "/((?!api/auth|auth/error|_next/static|_next/image|favicon.ico).*)",
  ],
};
