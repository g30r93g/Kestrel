"use server";

import { getOctokit } from "./client";

// Server action: the branch list for a repo plus its default branch. Returns
// empty on failure (missing access/scope) so the selector degrades gracefully.
export async function fetchBranches(
  owner: string,
  repo: string,
): Promise<{ branches: string[]; defaultBranch: string }> {
  // getOctokit() may redirect on a missing token — keep it outside the try.
  const octokit = await getOctokit();

  try {
    const [{ data: repoData }, { data: branchData }] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listBranches({ owner, repo, per_page: 100 }),
    ]);
    return {
      branches: branchData.map((b) => b.name),
      defaultBranch: repoData.default_branch,
    };
  } catch {
    return { branches: [], defaultBranch: "" };
  }
}
