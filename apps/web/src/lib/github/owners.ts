import { cache } from "react";
import { getOctokit } from "./client";
import type { Owner } from "./types";

// Authenticated user (personal scope) first, then their orgs. If listing orgs
// fails (e.g. the token lacks the `read:org` scope, or a transient error),
// degrade gracefully to the personal account rather than crashing the page.
export const getOwners = cache(async (): Promise<Owner[]> => {
  const octokit = await getOctokit();
  const { data: user } = await octokit.rest.users.getAuthenticated();

  const self: Owner = {
    login: user.login,
    name: user.name ?? user.login,
    type: "user",
    avatarUrl: user.avatar_url,
  };

  try {
    const { data: orgs } = await octokit.rest.orgs.listForAuthenticatedUser({
      per_page: 100,
    });
    return [
      self,
      ...orgs.map((o) => ({
        login: o.login,
        name: o.login,
        type: "org" as const,
        avatarUrl: o.avatar_url,
      })),
    ];
  } catch {
    return [self];
  }
});
