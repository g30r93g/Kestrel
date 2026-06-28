import type {
  CheckRollupState,
  EnrichedPullRequest,
  PRReviewState,
  PullsListFilter,
  ReviewsFilter,
  RowVerdict,
  RowVerdictStatus,
} from "./types";

// ── Risk-surface detection (shared with ZoneCodeDelta) ──────────────────────
const RISKY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /migration/i, label: "migrations" },
  { pattern: /auth/i, label: "auth" },
  { pattern: /\.env|secrets?/i, label: "secrets / env" },
  { pattern: /\.github\/workflows\//i, label: "CI config" },
  { pattern: /package-lock\.json|yarn\.lock|pnpm-lock/i, label: "lockfiles" },
  { pattern: /schema\.(ts|js|prisma|sql)/i, label: "schema" },
];

export function detectRiskySurfaces(filePaths: string[]): string[] {
  const found = new Set<string>();
  for (const path of filePaths) {
    for (const { pattern, label } of RISKY_PATTERNS) {
      if (pattern.test(path)) found.add(label);
    }
  }
  return [...found];
}

// ── GitHub search query construction ────────────────────────────────────────
export function buildSearchQuery(
  owner: string,
  repo: string,
  filter: PullsListFilter | ReviewsFilter,
): string {
  const base = `repo:${owner}/${repo} is:pr`;
  switch (filter) {
    case "open":
      return `${base} is:open`;
    case "mine":
      return `${base} is:open author:@me`;
    case "assigned":
      return `${base} is:open assignee:@me`;
    case "drafts":
      return `${base} is:open draft:true`;
    case "closed":
      return `${base} is:closed is:unmerged`;
    case "merged":
      return `${base} is:merged`;
    // ReviewsFilter values
    case "requested":
      return `${base} is:open review-requested:@me`;
    case "done":
      return `${base} reviewed-by:@me`;
    default:
      return `${base} is:open`;
  }
}

// ── Raw GraphQL node → EnrichedPullRequest ──────────────────────────────────
// Shape mirrors the PR_FIELDS selection in pulls-list.ts.
export interface RawPrNode {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatarUrl: string } | null;
  baseRefName: string;
  headRefName: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  files: { nodes: Array<{ path: string }> } | null;
  reviewRequests: {
    nodes: Array<{
      requestedReviewer:
        | { __typename: "User"; login: string; avatarUrl: string }
        | { __typename: "Team"; name: string }
        | { __typename: string }
        | null;
    }>;
  } | null;
  latestOpinionatedReviews: {
    nodes: Array<{ author: { login: string } | null; state: string }>;
  } | null;
  commits: {
    nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }>;
  } | null;
}

function mapLifecycle(
  state: RawPrNode["state"],
  isDraft: boolean,
): EnrichedPullRequest["state"] {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return isDraft ? "draft" : "open";
}

function mapRollup(state: string | null | undefined): CheckRollupState {
  switch (state) {
    case "SUCCESS":
      return "passing";
    case "FAILURE":
    case "ERROR":
      return "failing";
    case "PENDING":
    case "EXPECTED":
      return "running";
    default:
      return "none";
  }
}

function mapMergeable(m: RawPrNode["mergeable"]): EnrichedPullRequest["mergeable"] {
  if (m === "MERGEABLE") return "mergeable";
  if (m === "CONFLICTING") return "conflicting";
  return "unknown";
}

export function mapSearchNode(node: RawPrNode): EnrichedPullRequest {
  return {
    number: node.number,
    title: node.title,
    state: mapLifecycle(node.state, node.isDraft),
    author: {
      login: node.author?.login ?? "ghost",
      avatarUrl: node.author?.avatarUrl ?? "",
    },
    baseRef: node.baseRefName,
    headRef: node.headRefName,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    filePaths: (node.files?.nodes ?? []).map((f) => f.path),
    reviewDecision: node.reviewDecision,
    reviewRequests: (node.reviewRequests?.nodes ?? [])
      .map((r) => {
        const rr = r.requestedReviewer;
        if (!rr) return null;
        if (rr.__typename === "User") {
          const u = rr as { login: string; avatarUrl: string };
          return { login: u.login, avatarUrl: u.avatarUrl };
        }
        if (rr.__typename === "Team") {
          const t = rr as { name: string };
          return { login: t.name, avatarUrl: "" };
        }
        return null;
      })
      .filter((x): x is { login: string; avatarUrl: string } => x !== null),
    latestReviews: (node.latestOpinionatedReviews?.nodes ?? []).map((r) => ({
      login: r.author?.login ?? "ghost",
      state: r.state as PRReviewState,
    })),
    checkRollup: mapRollup(node.commits?.nodes?.[0]?.commit.statusCheckRollup?.state),
    mergeable: mapMergeable(node.mergeable),
  };
}

// ── Derived display logic ────────────────────────────────────────────────────
export function reviewStateForViewer(
  pr: EnrichedPullRequest,
  viewerLogin: string,
): PRReviewState | null {
  const mine = pr.latestReviews.find((r) => r.login === viewerLogin);
  return mine?.state ?? null;
}

export function rowVerdict(pr: EnrichedPullRequest): RowVerdict {
  if (pr.state === "merged") return { status: "MERGED", reason: "Merged" };
  if (pr.state === "closed") return { status: "CLOSED", reason: "Closed" };
  if (pr.state === "draft") return { status: "DRAFT", reason: "Draft" };

  if (pr.checkRollup === "failing")
    return { status: "NOT_READY", reason: "Checks failing" };
  if (pr.reviewDecision === "CHANGES_REQUESTED")
    return { status: "NOT_READY", reason: "Changes requested" };
  if (pr.mergeable === "conflicting")
    return { status: "NOT_READY", reason: "Merge conflicts" };
  if (pr.reviewDecision === "REVIEW_REQUIRED")
    return { status: "NEEDS_REVIEW", reason: "Review required" };
  return { status: "READY", reason: "Ready to merge" };
}

const URGENCY_RANK: Record<RowVerdictStatus, number> = {
  NOT_READY: 0,
  NEEDS_REVIEW: 1,
  READY: 2,
  DRAFT: 3,
  MERGED: 4,
  CLOSED: 5,
};

export function compareByUrgency(
  a: EnrichedPullRequest,
  b: EnrichedPullRequest,
): number {
  const ra = URGENCY_RANK[rowVerdict(a).status];
  const rb = URGENCY_RANK[rowVerdict(b).status];
  if (ra !== rb) return ra - rb;
  return a.createdAt.localeCompare(b.createdAt); // oldest first within a tier
}

export function timeAgo(iso: string): string {
  if (!iso) return "";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}
