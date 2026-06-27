"use client";

import { fetchEnrichedPullRequests } from "@/lib/github/pulls-list";
import type { PullsListFilter } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { GitPullRequest } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { PrRow } from "./pr-row";

const TABS: Array<{ filter: PullsListFilter; label: string; segment: string }> = [
  { filter: "open", label: "Open", segment: "" },
  { filter: "yours", label: "Yours", segment: "yours" },
  { filter: "requested", label: "Review requests", segment: "requested" },
  { filter: "merged", label: "Merged", segment: "merged" },
  { filter: "drafts", label: "Drafts", segment: "drafts" },
  { filter: "failing", label: "Failing", segment: "failing" },
  { filter: "running", label: "Running", segment: "running" },
];

export function PullsListView({
  owner,
  repo,
  filter,
}: {
  owner: string;
  repo: string;
  filter: PullsListFilter;
}) {
  const { data, isLoading, error } = useSWR(
    [owner, repo, filter, "pulls-list"],
    ([o, r, f]) => fetchEnrichedPullRequests(o, r, f as PullsListFilter),
  );

  const viewerLogin = data?.viewerLogin ?? "";
  const prs = data?.prs ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6 [scrollbar-gutter:stable]">
      <div className="flex flex-wrap items-center gap-1 border-b">
        {TABS.map((t) => {
          const href = t.segment
            ? `/${owner}/${repo}/pulls/${t.segment}`
            : `/${owner}/${repo}/pulls`;
          const active = t.filter === filter;
          return (
            <Link
              key={t.filter}
              href={href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                active
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">Could not load pull requests.</p>
      )}

      {!isLoading && !error && prs.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <GitPullRequest className="size-8 opacity-30" />
          <span>No pull requests here.</span>
        </div>
      )}

      {!isLoading && !error && prs.length > 0 && (
        <div className="flex flex-col gap-3">
          {prs.map((pr) => (
            <PrRow
              key={pr.number}
              pr={pr}
              owner={owner}
              repo={repo}
              viewerLogin={viewerLogin}
              actionLabel="Open"
            />
          ))}
          {data && data.issueCount > prs.length && (
            <p className="text-center text-xs text-muted-foreground">
              Showing first {prs.length} of {data.issueCount}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
