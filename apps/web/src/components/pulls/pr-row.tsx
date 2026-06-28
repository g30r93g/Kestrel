"use client";

import type {
  EnrichedPullRequest,
  PRReviewState,
  RowVerdictStatus,
} from "@/lib/github/types";
import {
  detectRiskySurfaces,
  reviewStateForViewer,
  rowVerdict,
  timeAgo,
} from "@/lib/github/pulls-list-utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CircleCheck,
  CircleDot,
  CircleX,
  GitPullRequest,
  Loader,
} from "lucide-react";
import Link from "next/link";

const ROLLUP_META = {
  passing: { icon: CircleCheck, label: "checks pass", cls: "text-green-600" },
  failing: { icon: CircleX, label: "checks failing", cls: "text-red-500" },
  running: { icon: Loader, label: "checks running", cls: "text-amber-600" },
  none: { icon: CircleDot, label: "no checks", cls: "text-muted-foreground" },
} as const;

const VERDICT_VARIANT: Record<
  RowVerdictStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  NOT_READY: "destructive",
  NEEDS_REVIEW: "default",
  READY: "secondary",
  MERGED: "secondary",
  DRAFT: "outline",
  CLOSED: "outline",
};

const VIEWER_REVIEW_LABEL: Record<PRReviewState, string> = {
  APPROVED: "you approved",
  CHANGES_REQUESTED: "you requested changes",
  COMMENTED: "you commented",
  DISMISSED: "your review dismissed",
  PENDING: "review pending",
};

export interface PrRowProps {
  pr: EnrichedPullRequest;
  owner: string;
  repo: string;
  viewerLogin: string;
  actionLabel?: string;
  showViewerReview?: boolean;
}

export function PrRow({
  pr,
  owner,
  repo,
  viewerLogin,
  actionLabel,
  showViewerReview,
}: PrRowProps) {
  const href = `/${owner}/${repo}/pulls/${pr.number}`;
  const verdict = rowVerdict(pr);
  const risks = detectRiskySurfaces(pr.filePaths);
  const rollup = ROLLUP_META[pr.checkRollup];
  const RollupIcon = rollup.icon;
  const viewerReview = showViewerReview
    ? reviewStateForViewer(pr, viewerLogin)
    : null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-sm font-medium">
              #{pr.number} {pr.title}
            </span>
            {risks.length > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5" />
                {risks.join(", ")}
              </span>
            )}
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            @{pr.author.login} · opened {timeAgo(pr.createdAt)} · updated{" "}
            {timeAgo(pr.updatedAt)}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-mono">
              <span className="text-green-600">+{pr.additions}</span>{" "}
              <span className="text-red-500">−{pr.deletions}</span>
            </span>
            <span className="text-muted-foreground">
              {pr.changedFiles} file{pr.changedFiles !== 1 ? "s" : ""}
            </span>
            <span className={`flex items-center gap-1 ${rollup.cls}`}>
              <RollupIcon
                className={`size-3.5 ${pr.checkRollup === "running" ? "animate-spin" : ""}`}
              />
              {rollup.label}
            </span>
            {viewerReview && (
              <span className="text-muted-foreground">
                {VIEWER_REVIEW_LABEL[viewerReview]}
              </span>
            )}
          </div>

          <div className="mt-2">
            <Badge variant={VERDICT_VARIANT[verdict.status]}>
              {verdict.reason}
            </Badge>
          </div>
        </div>

        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <GitPullRequest className="size-3.5" />
          {actionLabel ?? "Open"}
        </Link>
      </div>
    </div>
  );
}
