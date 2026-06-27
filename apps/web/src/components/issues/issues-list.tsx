"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Circle, CircleCheck, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchIssues } from "@/lib/github/issues";
import { formatTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Issue, IssueFilters, IssueState } from "@/lib/github/types";
import { IssuesFilterPopover } from "./issues-filter-popover";

const EMPTY_FILTERS: IssueFilters = {
  labels: [],
  assignee: null,
  milestone: null,
  author: null,
};

function applyFilters(
  issues: Issue[],
  state: IssueState,
  search: string,
  filters: IssueFilters,
): Issue[] {
  let result = issues.filter((i) => i.state === state);

  const q = search.trim().toLowerCase();
  if (q) {
    if (q.startsWith("#")) {
      const num = parseInt(q.slice(1), 10);
      if (!isNaN(num)) result = result.filter((i) => i.number === num);
    } else {
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }
  }

  if (filters.labels.length > 0) {
    result = result.filter((i) =>
      filters.labels.every((l) => i.labels.some((il) => il.name === l)),
    );
  }
  if (filters.assignee) {
    result = result.filter((i) =>
      i.assignees.some((a) => a.login === filters.assignee),
    );
  }
  if (filters.milestone) {
    result = result.filter((i) => i.milestone?.title === filters.milestone);
  }
  if (filters.author) {
    result = result.filter((i) => i.user.login === filters.author);
  }

  return result;
}

function IssueRow({
  issue,
  isSelected,
  onSelect,
}: {
  issue: Issue;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isOpen = issue.state === "open";
  const Icon = isOpen ? Circle : CircleCheck;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/40",
        isSelected && "bg-muted/60",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          isOpen
            ? "text-green-500 dark:text-green-400"
            : "text-purple-500 dark:text-purple-400",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <span className="truncate text-sm font-medium leading-snug">
            {issue.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            #{issue.number}
          </span>
        </div>

        {issue.labels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <span
                key={label.name}
                className="rounded-full px-1.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `#${label.color}33`,
                  color: `#${label.color}`,
                  border: `1px solid #${label.color}55`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Avatar size="sm">
            <AvatarImage src={issue.user.avatarUrl} alt={issue.user.login} />
            <AvatarFallback>
              {issue.user.login[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>{issue.user.login}</span>
          <span>·</span>
          <span>{formatTimeAgo(issue.createdAt)}</span>
          {issue.commentCount > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <MessageSquare className="size-3" />
                {issue.commentCount}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-2.5 px-3 py-3">
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function IssuesList({
  owner,
  repo,
  selectedIssueNumber,
  onSelect,
}: {
  owner: string;
  repo: string;
  selectedIssueNumber: number | null;
  onSelect: (n: number) => void;
}) {
  const [issueState, setIssueState] = useState<IssueState>("open");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<IssueFilters>(EMPTY_FILTERS);

  const { data: issues = [], isLoading } = useSWR(
    ["issues", owner, repo],
    () => fetchIssues(owner, repo),
  );

  const openCount = useMemo(
    () => issues.filter((i) => i.state === "open").length,
    [issues],
  );
  const closedCount = useMemo(
    () => issues.filter((i) => i.state === "closed").length,
    [issues],
  );

  const availableLabels = useMemo(
    () =>
      [...new Set(issues.flatMap((i) => i.labels.map((l) => l.name)))].sort(),
    [issues],
  );
  const availableAssignees = useMemo(
    () =>
      [...new Set(issues.flatMap((i) => i.assignees.map((a) => a.login)))].sort(),
    [issues],
  );
  const availableMilestones = useMemo(
    () =>
      [
        ...new Set(
          issues.flatMap((i) => (i.milestone ? [i.milestone.title] : [])),
        ),
      ].sort(),
    [issues],
  );
  const availableAuthors = useMemo(
    () => [...new Set(issues.map((i) => i.user.login))].sort(),
    [issues],
  );

  const visible = useMemo(
    () => applyFilters(issues, issueState, search, filters),
    [issues, issueState, search, filters],
  );

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Search */}
      <div className="border-b px-3 py-2">
        <Input
          placeholder="Search by title or #number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Filter */}
      <div className="border-b px-3 py-2">
        <IssuesFilterPopover
          filters={filters}
          onChange={setFilters}
          availableLabels={availableLabels}
          availableAssignees={availableAssignees}
          availableMilestones={availableMilestones}
          availableAuthors={availableAuthors}
        />
      </div>

      {/* Open / Closed toggle */}
      <div className="flex shrink-0 border-b">
        <button
          onClick={() => setIssueState("open")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-sm transition-colors hover:bg-muted/40",
            issueState === "open"
              ? "border-b-2 border-primary font-medium"
              : "text-muted-foreground",
          )}
        >
          <Circle className="size-3.5 text-green-500 dark:text-green-400" />
          {isLoading ? "—" : openCount} Open
        </button>
        <button
          onClick={() => setIssueState("closed")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-sm transition-colors hover:bg-muted/40",
            issueState === "closed"
              ? "border-b-2 border-primary font-medium"
              : "text-muted-foreground",
          )}
        >
          <CircleCheck className="size-3.5 text-purple-500 dark:text-purple-400" />
          {isLoading ? "—" : closedCount} Closed
        </button>
      </div>

      {/* Issue rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : visible.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No issues found.
          </div>
        ) : (
          <div className="divide-y">
            {visible.map((issue) => (
              <IssueRow
                key={issue.number}
                issue={issue}
                isSelected={selectedIssueNumber === issue.number}
                onSelect={() => onSelect(issue.number)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
