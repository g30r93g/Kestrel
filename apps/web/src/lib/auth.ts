import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

// Stateless mode: no `database` option is passed, so Better Auth stores the
// session in a signed/encrypted cookie and (auto-enabling account.storeAccountCookie)
// the GitHub tokens in an encrypted `account_data` cookie. BETTER_AUTH_SECRET and
// BETTER_AUTH_URL are read automatically from the environment.
export const auth = betterAuth({
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      scopes: ["read:user", "user:email", "read:org", "repo"],
    },
  },
  // nextCookies() must be the LAST plugin. It lets Better Auth set cookies
  // within the Next.js request lifecycle (server actions / route handlers).
  plugins: [nextCookies()],
});
