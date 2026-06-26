import { cache } from "react";
import { getOctokit } from "./client";
import type { Owner } from "./types";

// Authenticated user (personal scope) first, then their orgs.
export const getOwners = cache(async (): Promise<Owner[]> => {
  const octokit = await getOctokit();
  const [{ data: user }, { data: orgs }] = await Promise.all([
    octokit.rest.users.getAuthenticated(),
    octokit.rest.orgs.listForAuthenticatedUser({ per_page: 100 }),
  ]);

  return [
    {
      login: user.login,
      name: user.name ?? user.login,
      type: "user",
      avatarUrl: user.avatar_url,
    },
    ...orgs.map((o) => ({
      login: o.login,
      name: o.login,
      type: "org" as const,
      avatarUrl: o.avatar_url,
    })),
  ];
});
