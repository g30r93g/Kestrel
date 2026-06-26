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
