"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Grid2x2,
  List,
  Loader2,
  Shield,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchBranchDetails } from "@/lib/github/branch-details";
import { formatTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { BranchDetail, BranchFilter, CheckStatus } from "@/lib/github/types";

// ─── Shared atoms ────────────────────────────────────────────────────────────

function CheckStatusBadge({
  status,
  count,
}: {
  status: CheckStatus | null;
  count: number;
}) {
  if (!status) return null;

  const map = {
    passing: {
      Icon: CheckCircle2,
      cls: "text-green-600 dark:text-green-400",
      label: `${count} passing`,
    },
    failing: {
      Icon: XCircle,
      cls: "text-red-600 dark:text-red-400",
      label: `${count} failing`,
    },
    running: {
      Icon: Loader2,
      cls: "text-yellow-600 dark:text-yellow-400 animate-spin",
      label: "Running",
    },
    pending: {
      Icon: Clock,
      cls: "text-muted-foreground",
      label: "Pending",
    },
  } as const;

  const { Icon, cls, label } = map[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className={cn("flex items-center gap-1 text-xs", cls)} />}>
          <Icon className="size-3.5" />
          {label}
        </TooltipTrigger>
        <TooltipContent>CI checks: {label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AheadBehind({
  aheadBy,
  behindBy,
}: {
  aheadBy: number;
  behindBy: number;
}) {
  if (aheadBy === 0 && behindBy === 0) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="flex items-center gap-1.5 text-xs text-muted-foreground" />}>
          {aheadBy > 0 && (
            <span className="flex items-center gap-0.5">
              <ArrowUp className="size-3" />
              {aheadBy}
            </span>
          )}
          {behindBy > 0 && (
            <span className="flex items-center gap-0.5">
              <ArrowDown className="size-3" />
              {behindBy}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {aheadBy} ahead · {behindBy} behind default
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PRBadge({ pr }: { pr: NonNullable<BranchDetail["pullRequest"]> }) {
  const map = {
    open: {
      Icon: GitPullRequest,
      cls: "text-green-600 dark:text-green-400",
      label: "Open",
    },
    draft: {
      Icon: GitPullRequest,
      cls: "text-muted-foreground",
      label: "Draft",
    },
    merged: {
      Icon: GitMerge,
      cls: "text-purple-600 dark:text-purple-400",
      label: "Merged",
    },
    closed: {
      Icon: XCircle,
      cls: "text-muted-foreground",
      label: "Closed",
    },
  } as const;

  const { Icon, cls, label } = map[pr.state];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("flex items-center gap-1 text-xs hover:underline", cls)}
            />
          }
        >
          <Icon className="size-3.5" />#{pr.number}
        </TooltipTrigger>
        <TooltipContent>
          {label} PR: {pr.title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AuthorAvatar({ commit }: { commit: BranchDetail["lastCommit"] }) {
  const displayName = commit.authorName || commit.authorLogin || "?";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="cursor-default" />}>
          <Avatar size="sm">
            <AvatarImage src={commit.authorAvatarUrl} alt={displayName} />
            <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>{displayName}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BranchBadges({
  isDefault,
  isProtected,
}: {
  isDefault: boolean;
  isProtected: boolean;
}) {
  return (
    <>
      {isDefault && (
        <span className="rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground">
          default
        </span>
      )}
      {isProtected && (
        <span className="flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          <Shield className="size-3" />
          protected
        </span>
      )}
    </>
  );
}

// ─── List item ───────────────────────────────────────────────────────────────

function BranchListItem({ branch }: { branch: BranchDetail }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <GitBranch className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{branch.name}</span>
          <BranchBadges
            isDefault={branch.isDefault}
            isProtected={branch.isProtected}
          />
        </div>
        {branch.lastCommit.message && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {branch.lastCommit.message}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <AuthorAvatar commit={branch.lastCommit} />
          {branch.lastCommit.date && (
            <span>{formatTimeAgo(branch.lastCommit.date)}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <CheckStatusBadge
          status={branch.checkStatus}
          count={branch.checkCount}
        />
        {!branch.isDefault && (
          <AheadBehind
            aheadBy={branch.aheadBy}
            behindBy={branch.behindBy}
          />
        )}
        {branch.pullRequest && <PRBadge pr={branch.pullRequest} />}
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function BranchCard({ branch }: { branch: BranchDetail }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <GitBranch className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{branch.name}</span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <BranchBadges
              isDefault={branch.isDefault}
              isProtected={branch.isProtected}
            />
          </div>
        </div>
        {branch.lastCommit.message && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {branch.lastCommit.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AuthorAvatar commit={branch.lastCommit} />
        {branch.lastCommit.date && (
          <span>{formatTimeAgo(branch.lastCommit.date)}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <CheckStatusBadge
          status={branch.checkStatus}
          count={branch.checkCount}
        />
        {!branch.isDefault && (
          <AheadBehind
            aheadBy={branch.aheadBy}
            behindBy={branch.behindBy}
          />
        )}
        {branch.pullRequest && <PRBadge pr={branch.pullRequest} />}
      </div>
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="divide-y rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="mt-0.5 size-4 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="flex gap-3 border-t pt-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Filter logic ─────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function applyFilter(
  branches: BranchDetail[],
  filter: BranchFilter,
  currentUserLogin: string,
): BranchDetail[] {
  const now = Date.now();
  switch (filter) {
    case "yours":
      return branches.filter(
        (b) => b.lastCommit.authorLogin === currentUserLogin,
      );
    case "active":
      return branches.filter(
        (b) =>
          !b.isDefault &&
          b.lastCommit.date &&
          now - new Date(b.lastCommit.date).getTime() <= STALE_THRESHOLD_MS,
      );
    case "stale":
      return branches.filter(
        (b) =>
          !b.isDefault &&
          b.lastCommit.date &&
          now - new Date(b.lastCommit.date).getTime() > STALE_THRESHOLD_MS,
      );
    default:
      return branches;
  }
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function BranchesView({
  owner,
  repo,
  filter,
  currentUserLogin,
}: {
  owner: string;
  repo: string;
  filter: BranchFilter;
  currentUserLogin: string;
}) {
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

  const { data: branches, isLoading } = useSWR(
    ["branch-details", owner, repo],
    () => fetchBranchDetails(owner, repo),
  );

  const filtered = branches
    ? applyFilter(branches, filter, currentUserLogin)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading branches…"
            : `${filtered.length} branch${filtered.length !== 1 ? "es" : ""}`}
        </p>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
          >
            <List />
          </Button>
          <Button
            variant={viewMode === "card" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("card")}
            aria-label="Card view"
            aria-pressed={viewMode === "card"}
          >
            <Grid2x2 />
          </Button>
        </div>
      </div>

      {isLoading ? (
        viewMode === "list" ? (
          <ListSkeleton />
        ) : (
          <CardSkeleton />
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No branches match this filter.
        </div>
      ) : viewMode === "list" ? (
        <div className="divide-y rounded-lg border">
          {filtered.map((branch) => (
            <BranchListItem key={branch.name} branch={branch} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((branch) => (
            <BranchCard key={branch.name} branch={branch} />
          ))}
        </div>
      )}
    </div>
  );
}
