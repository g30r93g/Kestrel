"use client";

import type { PRFile, PullRequest } from "@/lib/github/types";
import { detectRiskySurfaces } from "@/lib/github/pulls-list-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, FileCode } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

function topDirs(files: PRFile[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const dir = f.filename.includes("/")
      ? f.filename.split("/").slice(0, 2).join("/")
      : "(root)";
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([dir]) => dir);
}

export interface ZoneCodeDeltaProps {
  pr: PullRequest | null;
  files: PRFile[];
  loading: boolean;
  error: boolean;
}

export function ZoneCodeDelta({ pr, files, loading, error }: ZoneCodeDeltaProps) {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2];
  const diffHref =
    owner && repo && prNumber
      ? `/${owner}/${repo}/pulls/${prNumber}/diff`
      : "#";

  const riskySurfaces = detectRiskySurfaces(files.map((f) => f.filename));
  const dirs = topDirs(files);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Code Delta</h2>
        {!loading && !error && pr && (
          <Link
            href={diffHref}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
          >
            <FileCode className="size-3.5" />
            Open diff
          </Link>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">Diff stats unavailable.</p>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}

      {!loading && !error && pr && (
        <>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-mono text-green-600">+{pr.additions}</span>
            <span className="font-mono text-red-500">−{pr.deletions}</span>
            <span className="text-muted-foreground">
              · {pr.changedFiles} file{pr.changedFiles !== 1 ? "s" : ""}
            </span>
          </div>

          {dirs.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Heavy: {dirs.join(", ")}
            </p>
          )}

          {riskySurfaces.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              touches {riskySurfaces.join(", ")}
            </div>
          )}

        </>

      )}

      {!loading && !error && !pr && (
        <p className="text-xs text-muted-foreground">No file changes.</p>
      )}
    </div>
  );
}
