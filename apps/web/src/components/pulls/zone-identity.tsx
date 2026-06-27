"use client";

import type { PullRequest } from "@/lib/github/types";
import { formatTimeAgo } from "@/lib/time";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CircleDot,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function StateIcon({ state }: { state: PullRequest["state"] }) {
  if (state === "merged")
    return <GitMerge className="mt-0.5 size-5 shrink-0 text-purple-500" />;
  if (state === "closed")
    return (
      <GitPullRequestClosed className="mt-0.5 size-5 shrink-0 text-red-500" />
    );
  if (state === "draft")
    return (
      <CircleDot className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
    );
  return (
    <GitPullRequest className="mt-0.5 size-5 shrink-0 text-green-500" />
  );
}

export interface ZoneIdentityProps {
  pr: PullRequest | null;
  loading: boolean;
  error: boolean;
}

export function ZoneIdentity({ pr, loading, error }: ZoneIdentityProps) {
  if (error) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm text-destructive">
        Could not load PR details.{" "}
        <button
          className="underline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !pr) {
    return (
      <div className="flex gap-3 rounded-lg border bg-card p-4">
        <Skeleton className="mt-0.5 size-5 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Title row */}
      <div className="flex items-start gap-3">
        <StateIcon state={pr.state} />
        <h1 className="min-w-0 flex-1 text-base font-semibold leading-snug">
          {pr.title}{" "}
          <span className="font-normal text-muted-foreground">#{pr.number}</span>
        </h1>
      </div>

      {/* Metadata — two lines, full width */}
      <div className="mt-2 space-y-0.5 pl-8 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{pr.author.login}</span>
          {" wants to merge "}
          <code className="rounded bg-muted px-1 text-xs">{pr.headRef}</code>
          {" → "}
          <code className="rounded bg-muted px-1 text-xs">{pr.baseRef}</code>
        </p>
        <p>
          {pr.commitCount} {pr.commitCount === 1 ? "commit" : "commits"}
          {" · opened "}
          {formatTimeAgo(pr.createdAt)}
          {pr.updatedAt !== pr.createdAt && (
            <> · updated {formatTimeAgo(pr.updatedAt)}</>
          )}
        </p>
      </div>

      {/* Labels */}
      {pr.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 pl-8">
          {pr.labels.map((l) => (
            <span
              key={l.name}
              className="rounded-full border px-2 py-0.5 text-xs font-medium"
              style={{ borderColor: `#${l.color}`, color: `#${l.color}` }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* PR description body */}
      {pr.body && (
        <div className="mt-3 border-t pt-3 pl-8">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{pr.body}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
