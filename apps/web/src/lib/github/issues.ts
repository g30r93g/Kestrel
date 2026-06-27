"use server";

import { getOctokit } from "./client";
import type { Issue, IssueTimelineEvent } from "./types";

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

export async function fetchIssueTimeline(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueTimelineEvent[]> {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.listEventsForTimeline({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const events: IssueTimelineEvent[] = [];
  for (const raw of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = raw as any;
    const actor = { login: e.actor?.login ?? "", avatarUrl: e.actor?.avatar_url ?? "" };
    switch (e.event) {
      case "commented":
        events.push({ kind: "comment", id: e.id, user: { login: e.user?.login ?? "", avatarUrl: e.user?.avatar_url ?? "" }, body: e.body ?? "", createdAt: e.created_at });
        break;
      case "cross-referenced":
        if (e.source?.issue) {
          events.push({ kind: "cross-referenced", actor, createdAt: e.created_at, source: { isPR: !!e.source.issue.pull_request, number: e.source.issue.number, title: e.source.issue.title ?? "", state: e.source.issue.state === "closed" ? "closed" : "open" } });
        }
        break;
      case "referenced":
        if (e.commit_id) events.push({ kind: "referenced", actor, commitId: e.commit_id as string, createdAt: e.created_at });
        break;
      case "closed":
        events.push({ kind: "closed", actor, createdAt: e.created_at, commitId: e.commit_id ?? null });
        break;
      case "reopened":
        events.push({ kind: "reopened", actor, createdAt: e.created_at });
        break;
      case "renamed":
        events.push({ kind: "renamed", actor, createdAt: e.created_at, from: e.rename?.from ?? "", to: e.rename?.to ?? "" });
        break;
      case "labeled":
        events.push({ kind: "labeled", actor, createdAt: e.created_at, label: { name: e.label?.name ?? "", color: e.label?.color ?? "" } });
        break;
      case "unlabeled":
        events.push({ kind: "unlabeled", actor, createdAt: e.created_at, label: { name: e.label?.name ?? "", color: e.label?.color ?? "" } });
        break;
      case "assigned":
        events.push({ kind: "assigned", actor, createdAt: e.created_at, assignee: { login: e.assignee?.login ?? "", avatarUrl: e.assignee?.avatar_url ?? "" } });
        break;
      case "unassigned":
        events.push({ kind: "unassigned", actor, createdAt: e.created_at, assignee: { login: e.assignee?.login ?? "", avatarUrl: e.assignee?.avatar_url ?? "" } });
        break;
      case "milestoned":
        events.push({ kind: "milestoned", actor, createdAt: e.created_at, milestone: e.milestone?.title ?? "" });
        break;
      case "demilestoned":
        events.push({ kind: "demilestoned", actor, createdAt: e.created_at, milestone: e.milestone?.title ?? "" });
        break;
    }
  }
  return events;
}

