import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Octokit } from "octokit";
import { auth } from "@/lib/auth";

// Pulls the GitHub access token from Better Auth's stateless `account_data`
// cookie (refreshing if needed) and returns a request-scoped Octokit client.
// The session cookie (7 days) can outlive the `account_data` token cookie
// (~300s default), so when the token is gone we send the user to re-auth
// rather than letting the page throw a 500.
export async function getOctokit() {
  try {
    const { accessToken } = await auth.api.getAccessToken({
      body: { providerId: "github" },
      headers: await headers(),
    });
    return new Octokit({ auth: accessToken });
  } catch {
    redirect("/sign-in");
  }
}
