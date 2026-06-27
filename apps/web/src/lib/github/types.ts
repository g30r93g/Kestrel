export interface Owner {
  login: string;
  name: string;
  type: "user" | "org";
  avatarUrl: string;
}

export interface Repo {
  name: string;
  owner: string;
  private: boolean;
}

export type BranchFilter = "all" | "yours" | "active" | "stale";
export type CheckStatus = "passing" | "failing" | "running" | "pending";

export interface BranchCommit {
  sha: string;
  message: string;
  authorName: string;
  authorLogin: string;
  authorAvatarUrl: string;
  date: string;
}

export interface BranchPR {
  number: number;
  title: string;
  state: "open" | "draft" | "merged" | "closed";
  url: string;
}

export interface BranchDetail {
  name: string;
  isDefault: boolean;
  isProtected: boolean;
  lastCommit: BranchCommit;
  checkStatus: CheckStatus | null;
  checkCount: number;
  aheadBy: number;
  behindBy: number;
  pullRequest: BranchPR | null;
}

export interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  sha: string;
  size?: number;
}

export interface HighlightToken {
  content: string;
  htmlStyle?: Record<string, string>;
}

export type FileData =
  | { kind: "text";     content: string; highlighted: HighlightToken[][] | null; downloadUrl: string | null; wasFormatted: boolean }
  | { kind: "image";    dataUri: string; mimeType: string; downloadUrl: string | null }
  | { kind: "svg";      content: string; dataUri: string; highlighted: HighlightToken[][] | null; downloadUrl: string | null }
  | { kind: "markdown"; content: string; highlighted: HighlightToken[][] | null; downloadUrl: string | null }
  | { kind: "csv";      content: string; downloadUrl: string | null }
  | { kind: "binary";   size: number; downloadUrl: string | null };

export interface FileCommit {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
  authorName: string;
}

export interface BlameRange {
  startLine: number;
  endLine: number;
  commitSha: string;
  commitDate: string;
  commitMessage: string;
  prNumber?: number;
  prTitle?: string;
}

export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  downloadCount: number;
  downloadUrl: string;
}

export const PACKAGE_TYPES = ["npm", "maven", "rubygems", "docker", "nuget", "container"] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export interface PackageDetail {
  id: number;
  name: string;
  packageType: PackageType;
  visibility: "public" | "private";
  versionCount: number;
  updatedAt: string;
  htmlUrl: string;
}

export interface TagsAndReleasesItem {
  name: string;
  sha: string;
  kind: "annotated" | "lightweight";
  message: string;
  tagger: {
    name: string;
    login: string;
    avatarUrl: string;
    date: string;
  };
  zipballUrl: string;
  tarballUrl: string;
  release: {
    id: number;
    title: string;
    body: string;
    htmlUrl: string;
    isDraft: boolean;
    isPrerelease: boolean;
    isLatest: boolean;
    publishedAt: string;
    author: {
      login: string;
      avatarUrl: string;
    };
    assets: ReleaseAsset[];
  } | null;
}

export interface IssueLabel {
  name: string;
  color: string;
}

export interface IssueUser {
  login: string;
  avatarUrl: string;
}

export interface IssueMilestone {
  title: string;
  number: number;
}

export type IssueState = "open" | "closed";

export interface Issue {
  number: number;
  title: string;
  state: IssueState;
  body: string | null;
  labels: IssueLabel[];
  assignees: IssueUser[];
  milestone: IssueMilestone | null;
  user: IssueUser;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface IssueComment {
  id: number;
  user: IssueUser;
  body: string;
  createdAt: string;
}

export interface IssueFilters {
  labels: string[];
  assignee: string | null;
  milestone: string | null;
  author: string | null;
}

export type IssueTimelineEvent =
  | { kind: "comment"; id: number; user: IssueUser; body: string; createdAt: string }
  | { kind: "cross-referenced"; actor: IssueUser; createdAt: string; source: { isPR: boolean; number: number; title: string; state: "open" | "closed" } }
  | { kind: "referenced"; actor: IssueUser; commitId: string; createdAt: string }
  | { kind: "closed"; actor: IssueUser; createdAt: string; commitId: string | null }
  | { kind: "reopened"; actor: IssueUser; createdAt: string }
  | { kind: "renamed"; actor: IssueUser; createdAt: string; from: string; to: string }
  | { kind: "labeled"; actor: IssueUser; createdAt: string; label: IssueLabel }
  | { kind: "unlabeled"; actor: IssueUser; createdAt: string; label: IssueLabel }
  | { kind: "assigned"; actor: IssueUser; createdAt: string; assignee: IssueUser }
  | { kind: "unassigned"; actor: IssueUser; createdAt: string; assignee: IssueUser }
  | { kind: "milestoned"; actor: IssueUser; createdAt: string; milestone: string }
  | { kind: "demilestoned"; actor: IssueUser; createdAt: string; milestone: string };

// --- Pull Requests ---

export type PRLifecycleState = "open" | "draft" | "merged" | "closed";

export type PRReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";

export type PRMergeableState = "mergeable" | "conflicting" | "unknown";

export type PRCheckStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "waiting"
  | "pending"
  | "requested";

export type PRCheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | null;

export interface PRUser {
  login: string;
  avatarUrl: string;
}

export interface PRLabel {
  name: string;
  color: string;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  state: PRLifecycleState;
  headRef: string;
  baseRef: string;
  author: PRUser;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequest extends PullRequestSummary {
  body: string;
  headSha: string;
  commitCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: PRLabel[];
  assignees: PRUser[];
  mergedAt: string | null;
  mergedBy: PRUser | null;
  autoMergeEnabled: boolean;
  mergeableState: PRMergeableState;
  behindBy: number;
  htmlUrl: string;
}

export interface PRReview {
  id: number;
  reviewer: PRUser;
  state: PRReviewState;
  submittedAt: string | null;
  body: string;
  isAutomated: boolean;
}

export interface PRCheckRun {
  id: number;
  name: string;
  status: PRCheckStatus;
  conclusion: PRCheckConclusion;
  detailsUrl: string;
  isRequired: boolean;
  workflowRunId: number | null;
  workflowName: string | null;
}

export interface CheckStep {
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CheckRunDetail {
  id: number;
  name: string;
  status: PRCheckStatus;
  conclusion: PRCheckConclusion;
  detailsUrl: string;
  startedAt: string | null;
  completedAt: string | null;
  output: {
    title: string | null;
    summary: string | null;
    text: string | null;
  };
  steps: CheckStep[];
  actionsJobId: number | null;
}

export interface PRComment {
  id: number;
  author: PRUser;
  body: string;
  createdAt: string;
}

export interface PRThread {
  id: string;
  path: string;
  line: number | null;
  isResolved: boolean;
  firstComment: PRComment;
}

export interface PRFile {
  filename: string;
  additions: number;
  deletions: number;
  status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
}

export type VerdictStatus = "READY" | "NOT_READY" | "MERGED" | "DRAFT" | "CLOSED";

export interface VerdictBlocker {
  kind: "check" | "review" | "conflict" | "threads" | "policy";
  label: string;
}

export interface VerdictState {
  status: VerdictStatus;
  blockers: VerdictBlocker[];
  notables: string[];
}

export type SignalKind =
  | "coverage"
  | "bundle"
  | "performance"
  | "security"
  | "deploy"
  | "quality"
  | "visual"
  | "dependency"
  | "automated-note";

export interface SignalChip {
  kind: SignalKind;
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  severity: "ok" | "warning" | "error";
  url?: string;
}

export interface PRActivity {
  id: string;
  type:
    | "committed"
    | "reviewed"
    | "commented"
    | "merged"
    | "closed"
    | "reopened"
    | "labeled"
    | "assigned"
    | "review_requested"
    | "base_changed"
    | "other";
  actor: PRUser | null;
  detail: string;
  createdAt: string;
}

export interface PRCollaborator {
  login: string;
  avatarUrl: string;
}

export interface PendingReviewComment {
  id: string;
  path: string;
  body: string;
  line: number;
  startLine?: number;
  side: "LEFT" | "RIGHT";
  startSide?: "LEFT" | "RIGHT";
  isFileLevel?: boolean;
  quotedText?: string;
}

export interface ReviewDraft {
  commitSha: string;
  comments: PendingReviewComment[];
  markedFiles: string[];
  body: string;
}

// --- Enriched PR list (Reviews queue + Pulls list) ---

export type CheckRollupState = "passing" | "failing" | "running" | "none";

export type PullsListFilter =
  | "open"
  | "yours"
  | "requested"
  | "merged"
  | "drafts"
  | "failing"
  | "running";

export type ReviewsFilter = "requested" | "done";

export interface EnrichedReviewRequest {
  login: string; // user login, or team name for team requests
  avatarUrl: string; // "" for teams
}

export interface EnrichedReview {
  login: string;
  state: PRReviewState;
}

export interface EnrichedPullRequest {
  number: number;
  title: string;
  state: PRLifecycleState;
  author: PRUser;
  baseRef: string;
  headRef: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  filePaths: string[];
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  reviewRequests: EnrichedReviewRequest[];
  latestReviews: EnrichedReview[];
  checkRollup: CheckRollupState;
  mergeable: PRMergeableState;
}

export type RowVerdictStatus =
  | "READY"
  | "NOT_READY"
  | "NEEDS_REVIEW"
  | "MERGED"
  | "DRAFT"
  | "CLOSED";

export interface RowVerdict {
  status: RowVerdictStatus;
  reason: string;
}

export interface EnrichedPullsResult {
  viewerLogin: string;
  issueCount: number;
  prs: EnrichedPullRequest[];
}
