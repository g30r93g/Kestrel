"use client";

import { fetchEnrichedPullRequests } from "@/lib/github/pulls-list";
import { compareByUrgency } from "@/lib/github/pulls-list-utils";
import type { ReviewsFilter } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { PrRow } from "./pr-row";

const TABS: Array<{ filter: ReviewsFilter; label: string; segment: string }> = [
  { filter: "requested", label: "Requested of me", segment: "" },
  { filter: "done", label: "I've reviewed", segment: "done" },
];

// NOTE: The standalone "Review Queue" sidebar entry was removed because it
// overlapped heavily with "Pull requests". This view is still reachable at
// /{owner}/{repo}/reviews and should be folded into the repo Overview view
// (the "Requested of me" queue is the piece worth surfacing there).
// TODO(overview): embed this queue (or its "requested" tab) into the Overview.

export function ReviewsView({
  owner,
  repo,
  filter,
}: {
  owner: string;
  repo: string;
  filter: ReviewsFilter;
}) {
  const { data, isLoading, error } = useSWR(
    [owner, repo, filter, "reviews-queue"],
    ([o, r, f]) => fetchEnrichedPullRequests(o, r, f as ReviewsFilter),
  );

  const viewerLogin = data?.viewerLogin ?? "";
  const prs = (data?.prs ?? []).slice();
  if (filter === "requested") prs.sort(compareByUrgency);
  else prs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6 [scrollbar-gutter:stable]">
      <div className="flex items-center gap-1 border-b">
        {TABS.map((t) => {
          const href = t.segment
            ? `/${owner}/${repo}/reviews/${t.segment}`
            : `/${owner}/${repo}/reviews`;
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

      {error && <p className="text-sm text-destructive">Could not load reviews.</p>}

      {!isLoading && !error && prs.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Eye className="size-8 opacity-30" />
          <span>
            {filter === "requested"
              ? "No reviews waiting on you."
              : "You haven't reviewed anything yet."}
          </span>
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
              actionLabel={filter === "requested" ? "Review" : "Open"}
              showViewerReview={filter === "done"}
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
