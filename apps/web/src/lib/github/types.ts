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
