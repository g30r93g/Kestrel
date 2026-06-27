"use client";

import type { PRReview } from "@/lib/github/types";
import { CollaboratorSelector } from "@/components/pulls/collaborator-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTimeAgo } from "@/lib/time";
import {
  CheckCircle2,
  CircleDot,
  MessageSquare,
  PenLine,
  UserPlus,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

function ReviewIcon({ state }: { state: PRReview["state"] }) {
  if (state === "APPROVED")
    return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
  if (state === "CHANGES_REQUESTED")
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  if (state === "DISMISSED")
    return <CircleDot className="size-4 shrink-0 text-muted-foreground" />;
  return <MessageSquare className="size-4 shrink-0 text-muted-foreground" />;
}

const STATE_LABEL: Record<PRReview["state"], string> = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  COMMENTED: "Commented",
  DISMISSED: "Dismissed",
  PENDING: "Pending",
};

export interface ZoneReviewsProps {
  reviews: PRReview[];
  loading: boolean;
  error: boolean;
}

export function ZoneReviews({ reviews, loading, error }: ZoneReviewsProps) {
  const { mutate } = useSWRConfig();
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2] ? parseInt(params.rest[2], 10) : undefined;

  const [requestOpen, setRequestOpen] = useState(false);

  const invalidate = () => {
    if (!owner || !repo || !prNumber) return;
    mutate([owner, repo, prNumber, "reviews"]);
    mutate([owner, repo, prNumber, "activity"]);
  };

  const latestByReviewer = new Map<string, PRReview>();
  for (const r of reviews.filter((r) => !r.isAutomated)) {
    const existing = latestByReviewer.get(r.reviewer.login);
    if (!existing || (r.submittedAt ?? "") > (existing.submittedAt ?? "")) {
      latestByReviewer.set(r.reviewer.login, r);
    }
  }
  const humanReviews = [...latestByReviewer.values()];
  const latestAutomated = new Map<string, PRReview>();
  for (const r of reviews.filter((r) => r.isAutomated)) {
    if (!latestAutomated.has(r.reviewer.login)) latestAutomated.set(r.reviewer.login, r);
  }
  const automatedReviews = [...latestAutomated.values()];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Reviews</h2>
        <div className="flex items-center gap-3">
          <Popover open={requestOpen} onOpenChange={setRequestOpen}>
            <PopoverTrigger
              className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
            >
              <UserPlus className="size-3.5" />
              Request reviewer
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              {owner && repo && prNumber && (
                <CollaboratorSelector
                  owner={owner}
                  repo={repo}
                  prNumber={prNumber}
                  onSuccess={() => {
                    setRequestOpen(false);
                    invalidate();
                  }}
                />
              )}
            </PopoverContent>
          </Popover>
          {owner && repo && prNumber && (
            <Link
              href={`/${owner}/${repo}/pulls/${prNumber}/diff?review=true`}
              className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
            >
              <PenLine className="size-3.5" />
              Add review
            </Link>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">Reviews unavailable.</p>}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {!loading && !error && humanReviews.length === 0 && (
        <p className="text-xs text-muted-foreground">No reviewers yet.</p>
      )}

      <ul className="space-y-2">
        {humanReviews.map((r) => (
          <li key={r.reviewer.login} className="flex items-center gap-2 text-sm">
            <ReviewIcon state={r.state} />
            <span className="font-medium">@{r.reviewer.login}</span>
            <span className="text-muted-foreground">{STATE_LABEL[r.state]}</span>
            {r.submittedAt && (
              <span className="ml-auto text-xs text-muted-foreground">
                {formatTimeAgo(r.submittedAt)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {automatedReviews.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Automated</p>
          <ul className="space-y-1.5">
            {automatedReviews.map((r) => (
              <li key={r.reviewer.login} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDot className="size-3 shrink-0" />
                {r.reviewer.login}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
