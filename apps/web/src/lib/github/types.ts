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
