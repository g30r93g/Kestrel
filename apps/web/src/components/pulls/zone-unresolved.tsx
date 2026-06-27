"use client";

import type { PRThread } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, MessageSquareMore } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface ZoneUnresolvedProps {
  threads: PRThread[]; // already filtered to isResolved === false
  loading: boolean;
  error: boolean;
}

export function ZoneUnresolved({ threads, loading, error }: ZoneUnresolvedProps) {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2];
  const diffBase =
    owner && repo && prNumber
      ? `/${owner}/${repo}/pulls/${prNumber}/diff`
      : null;

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Unresolved Threads</h2>

      {error && (
        <p className="text-xs text-destructive">Thread status unavailable.</p>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {!loading && !error && threads.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 text-green-500" />
          All threads resolved
        </div>
      )}

      {!loading && !error && threads.length > 0 && (
        <ul className="space-y-2">
          {threads.map((t) => {
            const href = diffBase
              ? `${diffBase}#${encodeURIComponent(t.path)}`
              : "#";
            return (
              <li key={t.id}>
                <Link
                  href={href}
                  className="flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <MessageSquareMore className="mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono">
                      {t.path}
                      {t.line != null ? `:${t.line}` : ""}
                    </span>
                    {t.firstComment.body && (
                      <p className="mt-0.5 truncate text-muted-foreground/70">
                        {t.firstComment.body.slice(0, 80)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
