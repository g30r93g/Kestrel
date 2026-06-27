"use client";

import type { PRActivity } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/time";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitCommitHorizontal,
  GitMerge,
  MessageSquare,
  X,
} from "lucide-react";
import { useState } from "react";

function ActivityIcon({ type }: { type: PRActivity["type"] }) {
  switch (type) {
    case "committed": return <GitCommitHorizontal className="size-3.5 shrink-0 text-muted-foreground" />;
    case "reviewed": return <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />;
    case "commented": return <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />;
    case "merged": return <GitMerge className="size-3.5 shrink-0 text-purple-500" />;
    case "closed": return <X className="size-3.5 shrink-0 text-red-500" />;
    default: return <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />;
  }
}

interface ZoneActivityProps {
  events: PRActivity[];
  loading: boolean;
  error: boolean;
}

export function ZoneActivity({ events, loading, error }: ZoneActivityProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="flex w-full items-center gap-2 p-4 text-left text-sm font-medium"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        Activity
        {!expanded && events.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            · {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          {error && (
            <p className="text-xs text-destructive">Activity unavailable.</p>
          )}

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <p className="text-xs text-muted-foreground">No activity yet.</p>
          )}

          {!loading && !error && (
            <ul className="space-y-2">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <ActivityIcon type={e.type} />
                  <div className="min-w-0 flex-1">
                    {e.actor && (
                      <span className="font-medium text-foreground">
                        @{e.actor.login}{" "}
                      </span>
                    )}
                    <span>{e.detail}</span>
                  </div>
                  <span className="shrink-0">{formatTimeAgo(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
