import { cache } from "react";
import { getOctokit } from "./client";
import type { Repo } from "./types";

// Repos for the given owner. Personal owner → the user's own repos;
// otherwise → the org's repos. (per_page 100; pagination is a follow-up.)
export const getReposForOwner = cache(async (owner: string): Promise<Repo[]> => {
  const octokit = await getOctokit();
  const { data: user } = await octokit.rest.users.getAuthenticated();

  if (owner === user.login) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      affiliation: "owner",
      sort: "updated",
      per_page: 100,
    });
    return data.map((r) => ({ name: r.name, owner: r.owner.login, private: r.private }));
  }

  const { data } = await octokit.rest.repos.listForOrg({
    org: owner,
    sort: "updated",
    per_page: 100,
  });
  return data.map((r) => ({ name: r.name, owner: r.owner.login, private: r.private }));
});
