"use client";

import type { PRComment } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/time";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PREVIEW_COUNT = 5;

interface ZoneConversationProps {
  comments: PRComment[];
  loading: boolean;
  error: boolean;
}

export function ZoneConversation({
  comments,
  loading,
  error,
}: ZoneConversationProps) {
  const preview = comments.slice(-PREVIEW_COUNT);
  const hiddenCount = Math.max(0, comments.length - PREVIEW_COUNT);

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Conversation</h2>

      {error && (
        <p className="text-xs text-destructive">Comments unavailable.</p>
      )}

      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && comments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No discussion yet — start the conversation below.
        </p>
      )}

      {!loading && !error && (
        <ul className="flex flex-col gap-4">
          {hiddenCount > 0 && (
            <li className="text-xs text-muted-foreground">
              {hiddenCount} earlier comment{hiddenCount > 1 ? "s" : ""} — view full thread for context
            </li>
          )}
          {preview.map((c) => (
            <li key={c.id}>
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  @{c.author.login}
                </span>
                <span>·</span>
                <span>{formatTimeAgo(c.createdAt)}</span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {c.body.length > 300 ? `${c.body.slice(0, 300)}…` : c.body}
                </ReactMarkdown>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
