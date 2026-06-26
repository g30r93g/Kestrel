import { headers } from "next/headers";
import { Octokit } from "octokit";
import { auth } from "@/lib/auth";

// Pulls the GitHub access token from Better Auth's stateless `account_data`
// cookie (refreshing if needed) and returns a request-scoped Octokit client.
export async function getOctokit() {
  const { accessToken } = await auth.api.getAccessToken({
    body: { providerId: "github" },
    headers: await headers(),
  });

  return new Octokit({ auth: accessToken });
}
