"use server";

import { getOctokit } from "./client";
import type {
  PullRequest,
  PullRequestSummary,
  PRActivity,
  PRCheckConclusion,
  PRCheckRun,
  PRCheckStatus,
  CheckRunDetail,
  PRComment,
  PRFile,
  PRLifecycleState,
  PRMergeableState,
  PRReview,
  PRReviewState,
  PRThread,
  PRCollaborator,
} from "./types";

// Logins that post automated comments — filtered out of human conversation (Zone G)
// and routed to signal parsing (Zone F) instead.
const BOT_LOGINS = new Set([
  "vercel[bot]",
  "netlify[bot]",
  "codecov[bot]",
  "github-actions[bot]",
  "dependabot[bot]",
  "snyk-bot",
  "sonarcloud[bot]",
  "coderabbitai[bot]",
  "copilot-swe-agent[bot]",
  "coveralls",
  "imgbot[bot]",
  "renovate[bot]",
  "allcontributors[bot]",
  "changeset-bot[bot]",
  "release-drafter[bot]",
]);

// Logins whose reviews are informational (AI reviewers) — shown in a demoted
// sub-lane in Zone C, never counted toward branch-protection requirements.
const AUTOMATED_REVIEWER_LOGINS = new Set([
  "copilot-swe-agent[bot]",
  "coderabbitai[bot]",
  "github-advanced-security[bot]",
]);

function toState(
  state: string,
  draft: boolean,
  mergedAt: string | null,
): PRLifecycleState {
  if (mergedAt) return "merged";
  if (draft) return "draft";
  return state as "open" | "closed";
}

export async function fetchPullRequests(
  owner: string,
  repo: string,
): Promise<PullRequestSummary[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 50,
    });
    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: toState(pr.state, pr.draft ?? false, pr.merged_at ?? null),
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      author: {
        login: pr.user?.login ?? "ghost",
        avatarUrl: pr.user?.avatar_url ?? "",
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function fetchPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequest | null> {
  const octokit = await getOctokit();
  try {
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    const { data: comparison } = await octokit.rest.repos
      .compareCommits({
        owner,
        repo,
        base: pr.base.ref,
        head: pr.head.sha,
      })
      .catch(() => ({ data: { behind_by: 0 } }));

    const mergeableState: PRMergeableState =
      pr.mergeable_state === "clean" || pr.mergeable_state === "unstable"
        ? "mergeable"
        : pr.mergeable_state === "dirty"
          ? "conflicting"
          : "unknown";

    return {
      number: pr.number,
      title: pr.title,
      state: toState(pr.state, pr.draft ?? false, pr.merged_at ?? null),
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      author: {
        login: pr.user?.login ?? "ghost",
        avatarUrl: pr.user?.avatar_url ?? "",
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      body: pr.body ?? "",
      headSha: pr.head.sha,
      commitCount: pr.commits,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
      assignees: (pr.assignees ?? []).map((a) => ({
        login: a.login,
        avatarUrl: a.avatar_url,
      })),
      mergedAt: pr.merged_at ?? null,
      mergedBy: pr.merged_by
        ? { login: pr.merged_by.login, avatarUrl: pr.merged_by.avatar_url }
        : null,
      autoMergeEnabled: pr.auto_merge !== null,
      mergeableState,
      behindBy: comparison.behind_by ?? 0,
      htmlUrl: pr.html_url,
    };
  } catch {
    return null;
  }
}

export async function fetchPullRequestReviews(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRReview[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return data.map((r) => ({
      id: r.id,
      reviewer: {
        login: r.user?.login ?? "ghost",
        avatarUrl: r.user?.avatar_url ?? "",
      },
      state: r.state as PRReviewState,
      submittedAt: r.submitted_at ?? null,
      body: r.body,
      isAutomated: AUTOMATED_REVIEWER_LOGINS.has(r.user?.login ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchPullRequestChecks(
  owner: string,
  repo: string,
  headSha: string,
  baseRef: string,
): Promise<PRCheckRun[]> {
  const octokit = await getOctokit();
  try {
    const [{ data: checksData }, branchProtection] = await Promise.all([
      octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: headSha,
        per_page: 100,
      }),
      octokit.rest.repos
        .getBranchProtection({ owner, repo, branch: baseRef })
        .then((res) => res.data)
        .catch(() => null),
    ]);

    const contextNames = branchProtection?.required_status_checks?.contexts ?? [];
    const checkNames = ((branchProtection?.required_status_checks as { checks?: { context: string; app_id: number | null }[] } | null | undefined)?.checks ?? []).map(
      (c: { context: string; app_id: number | null }) => c.context,
    );
    const requiredNames = new Set<string>([...contextNames, ...checkNames]);

    const extractRunId = (url: string) => {
      const m = url.match(/\/actions\/runs\/(\d+)\/job\//);
      return m ? parseInt(m[1], 10) : null;
    };

    const runIds = new Set<number>();
    for (const c of checksData.check_runs) {
      const runId = extractRunId(c.details_url ?? "");
      if (runId) runIds.add(runId);
    }

    const workflowNames = new Map<number, string>();
    await Promise.all(
      [...runIds].map(async (runId) => {
        try {
          const { data } = await octokit.request(
            "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
            { owner, repo, run_id: runId },
          );
          workflowNames.set(runId, (data as { name: string }).name);
        } catch {
          // ignore — workflow name will be omitted
        }
      }),
    );

    return checksData.check_runs.map((c) => {
      const workflowRunId = extractRunId(c.details_url ?? "");
      return {
        id: c.id,
        name: c.name,
        status: c.status as PRCheckStatus,
        conclusion: (c.conclusion ?? null) as PRCheckConclusion,
        detailsUrl: c.details_url ?? "",
        isRequired: requiredNames.has(c.name),
        workflowRunId,
        workflowName: workflowRunId ? (workflowNames.get(workflowRunId) ?? null) : null,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchPullRequestComments(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{
  humanComments: PRComment[];
  botComments: Array<{ login: string; body: string }>;
}> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    });

    const humanComments: PRComment[] = [];
    const botComments: Array<{ login: string; body: string }> = [];

    for (const c of data) {
      const login = c.user?.login ?? "";
      if (BOT_LOGINS.has(login) || login.endsWith("[bot]")) {
        botComments.push({ login, body: c.body ?? "" });
      } else {
        humanComments.push({
          id: c.id,
          author: { login, avatarUrl: c.user?.avatar_url ?? "" },
          body: c.body ?? "",
          createdAt: c.created_at,
        });
      }
    }

    return { humanComments, botComments };
  } catch {
    return { humanComments: [], botComments: [] };
  }
}

interface ThreadsGQLResult {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: Array<{
          id: string;
          isResolved: boolean;
          path: string;
          line: number | null;
          comments: {
            nodes: Array<{
              author: { login: string; avatarUrl: string } | null;
              body: string;
              createdAt: string;
            }>;
          };
        }>;
      };
    } | null;
  };
}

export async function fetchPullRequestThreads(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRThread[]> {
  const octokit = await getOctokit();
  try {
    const result = await octokit.graphql<ThreadsGQLResult>(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 50) {
              nodes {
                id
                isResolved
                path
                line
                comments(first: 1) {
                  nodes {
                    author { login avatarUrl }
                    body
                    createdAt
                  }
                }
              }
            }
          }
        }
      }`,
      { owner, repo, number: pullNumber },
    );

    const nodes =
      result.repository.pullRequest?.reviewThreads.nodes ?? [];

    return nodes.map((t) => {
      const first = t.comments.nodes[0];
      return {
        id: t.id,
        path: t.path,
        line: t.line,
        isResolved: t.isResolved,
        firstComment: {
          id: 0,
          author: {
            login: first?.author?.login ?? "ghost",
            avatarUrl: first?.author?.avatarUrl ?? "",
          },
          body: first?.body ?? "",
          createdAt: first?.createdAt ?? "",
        },
      };
    });
  } catch {
    return [];
  }
}

export async function fetchPullRequestFiles(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRFile[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    return data.map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status as PRFile["status"],
    }));
  } catch {
    return [];
  }
}

export interface PatchFile {
  filename: string;
  status: PRFile["status"];
  additions: number;
  deletions: number;
  patch: string | null;
}

export async function fetchPullRequestPatches(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PatchFile[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    return data
      .filter((f) => f.status !== "unchanged")
      .map((f) => ({
        filename: f.filename,
        status: f.status as PRFile["status"],
        additions: f.additions,
        deletions: f.deletions,
        patch: (f as { patch?: string }).patch ?? null,
      }));
  } catch {
    return [];
  }
}

function mapEventType(event: string): PRActivity["type"] {
  switch (event) {
    case "committed": return "committed";
    case "review_requested": return "review_requested";
    case "reviewed": return "reviewed";
    case "commented": return "commented";
    case "merged": return "merged";
    case "closed": return "closed";
    case "reopened": return "reopened";
    case "labeled":
    case "unlabeled": return "labeled";
    case "assigned":
    case "unassigned": return "assigned";
    case "base_ref_changed": return "base_changed";
    default: return "other";
  }
}

export async function fetchPullRequestActivity(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRActivity[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.issues.listEvents({
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    });
    return data.map((e, i) => ({
      id: String(e.id ?? i),
      type: mapEventType(e.event ?? ""),
      actor: e.actor
        ? { login: e.actor.login, avatarUrl: e.actor.avatar_url }
        : null,
      detail: e.event ?? "",
      createdAt: (e as { created_at?: string }).created_at ?? "",
    }));
  } catch {
    return [];
  }
}

function extractActionsJobId(detailsUrl: string): number | null {
  const m = detailsUrl.match(/\/job\/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

export async function fetchCheckRunDetails(
  owner: string,
  repo: string,
  checkRunId: number,
): Promise<CheckRunDetail | null> {
  const octokit = await getOctokit();
  try {
    const { data: cr } = await octokit.rest.checks.get({
      owner,
      repo,
      check_run_id: checkRunId,
    });

    const jobId = extractActionsJobId(cr.details_url ?? "");
    let steps: CheckRunDetail["steps"] = [];

    if (jobId) {
      try {
        const { data: job } = await octokit.request(
          "GET /repos/{owner}/{repo}/actions/jobs/{job_id}",
          { owner, repo, job_id: jobId },
        );
        steps = ((job as { steps?: unknown[] }).steps ?? []).map(
          (s: unknown) => {
            const step = s as {
              number: number;
              name: string;
              status: string;
              conclusion: string | null;
              started_at?: string | null;
              completed_at?: string | null;
            };
            return {
              number: step.number,
              name: step.name,
              status: step.status,
              conclusion: step.conclusion ?? null,
              startedAt: step.started_at ?? null,
              completedAt: step.completed_at ?? null,
            };
          },
        );
      } catch {
        // Non-Actions check — steps unavailable, continue with output only
      }
    }

    return {
      id: cr.id,
      name: cr.name,
      status: cr.status as PRCheckStatus,
      conclusion: (cr.conclusion ?? null) as PRCheckConclusion,
      detailsUrl: cr.details_url ?? "",
      startedAt: cr.started_at ?? null,
      completedAt: cr.completed_at ?? null,
      output: {
        title: cr.output.title ?? null,
        summary: cr.output.summary ?? null,
        text: cr.output.text ?? null,
      },
      steps,
      actionsJobId: jobId,
    };
  } catch {
    return null;
  }
}

function parseJobLogs(text: string): Record<string, string> {
  const clean = text.replace(/\x1B\[[0-9;]*m/g, "");
  const lines = clean.split("\n");
  const result: Record<string, string> = {};
  let currentName: string | null = null;
  let currentLines: string[] = [];
  let depth = 0;

  const flush = () => {
    if (currentName !== null && currentLines.length > 0) {
      result[currentName] = currentLines.join("\n").trim();
    }
  };

  for (const line of lines) {
    const content = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z /, "");
    if (content.startsWith("##[group]")) {
      if (depth === 0) {
        flush();
        currentName = content.slice("##[group]".length).trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
      depth++;
    } else if (content.startsWith("##[endgroup]")) {
      depth = Math.max(0, depth - 1);
      if (depth > 0) currentLines.push(line);
    } else if (depth > 0) {
      currentLines.push(line);
    }
  }
  flush();

  return result;
}

export async function fetchJobLogs(
  owner: string,
  repo: string,
  jobId: number,
): Promise<Record<string, string>> {
  const octokit = await getOctokit();
  try {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
      { owner, repo, job_id: jobId },
    );
    const text =
      typeof response.data === "string"
        ? response.data
        : new TextDecoder().decode(response.data as ArrayBuffer);
    return parseJobLogs(text);
  } catch {
    return {};
  }
}

export async function fetchCollaborators(
  owner: string,
  repo: string,
): Promise<PRCollaborator[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.repos.listCollaborators({
      owner,
      repo,
      per_page: 100,
    });
    return data.map((u) => ({ login: u.login, avatarUrl: u.avatar_url }));
  } catch {
    return [];
  }
}
