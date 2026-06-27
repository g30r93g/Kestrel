"use client";

import type { PRThread } from "@/lib/github/types";
import { resolveThread } from "@/lib/github/pulls-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CheckCheck, MessageSquareMore } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";

export interface ZoneUnresolvedProps {
  threads: PRThread[]; // already filtered to isResolved === false
  loading: boolean;
  error: boolean;
}

export function ZoneUnresolved({ threads, loading, error }: ZoneUnresolvedProps) {
  const { mutate } = useSWRConfig();
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2] ? parseInt(params.rest[2], 10) : undefined;
  const diffBase =
    owner && repo && prNumber
      ? `/${owner}/${repo}/pulls/${prNumber}/diff`
      : null;

  const handleResolve = async (threadId: string) => {
    if (!owner || !repo || !prNumber) return;
    const key = [owner, repo, prNumber, "threads"];
    // Optimistic: mark as resolved in SWR cache
    mutate(
      key,
      (current: PRThread[] | undefined) =>
        current?.map((t) => (t.id === threadId ? { ...t, isResolved: true } : t)),
      { revalidate: false },
    );
    const result = await resolveThread(threadId);
    if (!result.success) {
      // Rollback
      mutate(key);
    }
  };

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Unresolved Threads</h2>

      {error && <p className="text-xs text-destructive">Thread status unavailable.</p>}

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
              <li key={t.id} className="flex items-start gap-2">
                <MessageSquareMore className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <span className="font-mono">
                      {t.path}
                      {t.line != null ? `:${t.line}` : ""}
                    </span>
                    {t.firstComment.body && (
                      <p className="mt-0.5 truncate text-muted-foreground/70">
                        {t.firstComment.body.slice(0, 80)}
                      </p>
                    )}
                  </Link>
                </div>
                {/* Resolve button — top-right of thread item */}
                <button
                  onClick={() => handleResolve(t.id)}
                  title="Resolve thread"
                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                >
                  <CheckCheck className="size-3.5" />
                  Resolve
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
