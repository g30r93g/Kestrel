"use server";

import { getOctokit } from "./client";
import type { BranchDetail, CheckStatus } from "./types";

function aggregateChecks(
  runs: Array<{ status: string; conclusion: string | null }>,
): { status: CheckStatus | null; count: number } {
  if (runs.length === 0) return { status: null, count: 0 };

  const failing = ["failure", "timed_out", "cancelled", "action_required"];
  if (runs.some((r) => failing.includes(r.conclusion ?? ""))) {
    return { status: "failing", count: runs.length };
  }
  if (runs.some((r) => r.status === "in_progress" || r.status === "queued")) {
    return { status: "running", count: runs.length };
  }
  if (runs.every((r) => r.status === "completed")) {
    return { status: "passing", count: runs.length };
  }
  return { status: "pending", count: runs.length };
}

export async function fetchBranchDetails(
  owner: string,
  repo: string,
): Promise<BranchDetail[]> {
  const octokit = await getOctokit();

  const [{ data: repoData }, { data: branchList }] = await Promise.all([
    octokit.rest.repos.get({ owner, repo }),
    octokit.rest.repos.listBranches({ owner, repo, per_page: 100 }),
  ]);

  const defaultBranch = repoData.default_branch;

  const details = await Promise.all(
    branchList.map(async (branch): Promise<BranchDetail> => {
      const isDefault = branch.name === defaultBranch;

      const [commitRes, checksRes, compareRes, prsRes] =
        await Promise.allSettled([
          octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: branch.commit.sha,
          }),
          octokit.rest.checks.listForRef({
            owner,
            repo,
            ref: branch.commit.sha,
            per_page: 100,
          }),
          isDefault
            ? Promise.resolve(null)
            : octokit.rest.repos.compareCommitsWithBasehead({
                owner,
                repo,
                basehead: `${defaultBranch}...${branch.name}`,
              }),
          octokit.rest.pulls.list({
            owner,
            repo,
            head: `${owner}:${branch.name}`,
            state: "all",
            per_page: 1,
            sort: "updated",
            direction: "desc",
          }),
        ]);

      const commit =
        commitRes.status === "fulfilled" ? commitRes.value.data : null;
      const checkRuns =
        checksRes.status === "fulfilled"
          ? checksRes.value.data.check_runs
          : [];
      const compare =
        compareRes.status === "fulfilled" ? compareRes.value?.data : null;
      const prs =
        prsRes.status === "fulfilled" ? prsRes.value.data : [];

      const { status: checkStatus, count: checkCount } =
        aggregateChecks(checkRuns);

      const pr = prs[0] ?? null;
      let prState: "open" | "draft" | "merged" | "closed" = "open";
      if (pr) {
        if (pr.draft) prState = "draft";
        else if (pr.state === "open") prState = "open";
        else if (pr.merged_at) prState = "merged";
        else prState = "closed";
      }

      return {
        name: branch.name,
        isDefault,
        isProtected: branch.protected,
        lastCommit: {
          sha: branch.commit.sha,
          message: (commit?.commit.message ?? "").split("\n")[0],
          authorName:
            commit?.commit.author?.name ?? commit?.author?.login ?? "",
          authorLogin: commit?.author?.login ?? "",
          authorAvatarUrl: commit?.author?.avatar_url ?? "",
          date: commit?.commit.author?.date ?? "",
        },
        checkStatus,
        checkCount,
        aheadBy: compare?.ahead_by ?? 0,
        behindBy: compare?.behind_by ?? 0,
        pullRequest: pr
          ? {
              number: pr.number,
              title: pr.title,
              state: prState,
              url: pr.html_url,
            }
          : null,
      };
    }),
  );

  return details.sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return (
      new Date(b.lastCommit.date).getTime() -
      new Date(a.lastCommit.date).getTime()
    );
  });
}
