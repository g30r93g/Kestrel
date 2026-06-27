"use server";

import { getOctokit } from "./client";

export async function fetchBranches(
  owner: string,
  repo: string,
): Promise<{ branches: string[]; defaultBranch: string }> {
  const octokit = await getOctokit();

  try {
    const [{ data: repoData }, { data: branchData }] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listBranches({ owner, repo, per_page: 100 }),
    ]);

    const defaultBranch = repoData.default_branch;

    // Fetch last commit date for each branch using the lightweight git object
    // endpoint (no diff payload). allSettled so one failure doesn't drop all.
    const withDates = await Promise.allSettled(
      branchData.map(async (b) => {
        const { data } = await octokit.rest.git.getCommit({
          owner,
          repo,
          commit_sha: b.commit.sha,
        });
        return { name: b.name, date: data.committer.date };
      }),
    );

    const dated = withDates.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { name: branchData[i].name, date: "" },
    );

    const nonDefault = dated
      .filter((b) => b.name !== defaultBranch)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((b) => b.name);

    const hasDefault = branchData.some((b) => b.name === defaultBranch);
    const branches = hasDefault ? [defaultBranch, ...nonDefault] : nonDefault;

    return { branches, defaultBranch };
  } catch {
    return { branches: [], defaultBranch: "" };
  }
}
