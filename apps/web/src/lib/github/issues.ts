"use server";

import { getOctokit } from "./client";
import type { Issue, IssueComment } from "./types";

function mapIssue(issue: {
  number: number;
  title: string;
  state: string;
  body?: string | null;
  labels: Array<string | { name?: string | null; color?: string | null }>;
  assignees?: Array<{ login: string; avatar_url: string }> | null;
  milestone?: { title: string; number: number } | null;
  user?: { login: string; avatar_url: string } | null;
  created_at: string;
  updated_at: string;
  comments: number;
}): Issue {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state === "closed" ? "closed" : "open",
    body: issue.body ?? null,
    labels: issue.labels
      .filter((l): l is { name?: string | null; color?: string | null } => typeof l !== "string")
      .map((l) => ({ name: l.name ?? "", color: l.color ?? "" })),
    assignees: (issue.assignees ?? []).map((a) => ({
      login: a.login,
      avatarUrl: a.avatar_url,
    })),
    milestone: issue.milestone
      ? { title: issue.milestone.title, number: issue.milestone.number }
      : null,
    user: {
      login: issue.user?.login ?? "",
      avatarUrl: issue.user?.avatar_url ?? "",
    },
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    commentCount: issue.comments,
  };
}

export async function fetchIssues(owner: string, repo: string): Promise<Issue[]> {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: "all",
    per_page: 100,
  });
  return data
    .filter((issue) => !issue.pull_request)
    .map(mapIssue);
}

export async function fetchIssueDetail(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<Issue> {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return mapIssue(data);
}

export async function fetchIssueComments(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueComment[]> {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  return data.map((c) => ({
    id: c.id,
    user: {
      login: c.user?.login ?? "",
      avatarUrl: c.user?.avatar_url ?? "",
    },
    body: c.body ?? "",
    createdAt: c.created_at,
  }));
}
