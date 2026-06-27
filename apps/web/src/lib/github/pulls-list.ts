"use server";

import { getOctokit } from "./client";
import {
  buildSearchQuery,
  mapSearchNode,
  type RawPrNode,
} from "./pulls-list-utils";
import type {
  EnrichedPullsResult,
  PullsListFilter,
  ReviewsFilter,
} from "./types";

const PR_FIELDS = `
  number
  title
  state
  isDraft
  createdAt
  updatedAt
  author { login avatarUrl }
  baseRefName
  headRefName
  additions
  deletions
  changedFiles
  mergeable
  reviewDecision
  files(first: 100) { nodes { path } }
  reviewRequests(first: 20) {
    nodes {
      requestedReviewer {
        __typename
        ... on User { login avatarUrl }
        ... on Team { name }
      }
    }
  }
  latestOpinionatedReviews(first: 20) {
    nodes { author { login } state }
  }
  commits(last: 1) {
    nodes { commit { statusCheckRollup { state } } }
  }
`;

interface SearchResult {
  viewer: { login: string };
  search: {
    issueCount: number;
    nodes: Array<RawPrNode | Record<string, never>>;
  };
}

export async function fetchEnrichedPullRequests(
  owner: string,
  repo: string,
  filter: PullsListFilter | ReviewsFilter,
): Promise<EnrichedPullsResult> {
  const octokit = await getOctokit();
  const q = buildSearchQuery(owner, repo, filter);
  try {
    const result = await octokit.graphql<SearchResult>(
      `query($q: String!, $first: Int!) {
        viewer { login }
        search(query: $q, type: ISSUE, first: $first) {
          issueCount
          nodes {
            __typename
            ... on PullRequest {
              ${PR_FIELDS}
            }
          }
        }
      }`,
      { q, first: 50 },
    );

    const nodes = result.search.nodes.filter(
      (n): n is RawPrNode => "number" in n,
    );

    return {
      viewerLogin: result.viewer.login,
      issueCount: result.search.issueCount,
      prs: nodes.map(mapSearchNode),
    };
  } catch {
    return { viewerLogin: "", issueCount: 0, prs: [] };
  }
}
