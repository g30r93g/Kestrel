"use server";

import { getOctokit } from "./client";

export async function submitReview(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      event,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Review failed" };
  }
}

export async function requestReview(
  owner: string,
  repo: string,
  pullNumber: number,
  reviewers: string[],
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: pullNumber,
      reviewers,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

export async function addComment(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
): Promise<{ success: boolean; commentId?: number; error?: string }> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
    return { success: true, commentId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Comment failed" };
  }
}

export async function deleteComment(
  owner: string,
  repo: string,
  commentId: number,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.issues.deleteComment({
      owner,
      repo,
      comment_id: commentId,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
}

export async function resolveThread(
  threadNodeId: string,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.graphql(
      `mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread { id isResolved }
        }
      }`,
      { threadId: threadNodeId },
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Resolve failed" };
  }
}

export async function unresolveThread(
  threadNodeId: string,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.graphql(
      `mutation($threadId: ID!) {
        unresolveReviewThread(input: { threadId: $threadId }) {
          thread { id isResolved }
        }
      }`,
      { threadId: threadNodeId },
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unresolve failed" };
  }
}

export async function mergePullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  method: "merge" | "squash" | "rebase",
  commitTitle?: string,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: method,
      ...(commitTitle ? { commit_title: commitTitle } : {}),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Merge failed" };
  }
}

export async function closePullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: pullNumber,
      state: "closed",
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Close failed" };
  }
}

export async function reopenPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: pullNumber,
      state: "open",
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Reopen failed" };
  }
}

export async function updatePullRequestBody(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: pullNumber,
      body,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function updateBranch(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.pulls.updateBranch({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}
