import { cache } from "react";
import { getOctokit } from "./client";
import type { Repo } from "./types";

// Repos for the given owner. Personal owner → the user's own repos; otherwise
// → the org's repos. Degrades to an empty list on failure (e.g. missing scope
// or no access) so the dashboard layout never crashes. (per_page 100;
// pagination is a follow-up.)
export const getReposForOwner = cache(async (owner: string): Promise<Repo[]> => {
  // getOctokit() may redirect on a missing token — keep it OUTSIDE the try so
  // its NEXT_REDIRECT is never swallowed.
  const octokit = await getOctokit();

  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();

    if (owner === user.login) {
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        affiliation: "owner",
        sort: "pushed",
        per_page: 100,
      });
      return data.map((r) => ({ name: r.name, owner: r.owner.login, private: r.private }));
    }

    const { data } = await octokit.rest.repos.listForOrg({
      org: owner,
      sort: "pushed",
      per_page: 100,
    });
    return data.map((r) => ({ name: r.name, owner: r.owner.login, private: r.private }));
  } catch {
    return [];
  }
});
