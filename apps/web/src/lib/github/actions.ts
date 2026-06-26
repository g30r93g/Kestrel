"use server";

import { getOctokit } from "./client";
import type { Owner, Repo } from "./types";

export async function fetchOwners(): Promise<Owner[]> {
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
}

export async function fetchReposForOwner(owner: string): Promise<Repo[]> {
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
}
