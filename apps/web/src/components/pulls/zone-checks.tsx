"use client";

import type { PRCheckRun } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";

function CheckIcon({ run }: { run: PRCheckRun }) {
  if (run.status !== "completed")
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  if (
    run.conclusion === "success" ||
    run.conclusion === "neutral" ||
    run.conclusion === "skipped"
  )
    return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
  if (
    run.conclusion === "failure" ||
    run.conclusion === "timed_out" ||
    run.conclusion === "action_required"
  )
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  return <CircleDot className="size-4 shrink-0 text-muted-foreground" />;
}

export interface ZoneChecksProps {
  checks: PRCheckRun[];
  loading: boolean;
  error: boolean;
}

export function ZoneChecks({ checks, loading, error }: ZoneChecksProps) {
  const requiredChecks = checks.filter((c) => c.isRequired);
  const allChecksCount = checks.length;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Checks</h2>

      {error && (
        <p className="text-xs text-destructive">
          Checks unavailable.{" "}
          <a href="https://github.com" className="underline" target="_blank" rel="noreferrer">
            View on GitHub
          </a>
        </p>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      )}

      {!loading && !error && requiredChecks.length === 0 && allChecksCount === 0 && (
        <p className="text-xs text-muted-foreground">No checks configured.</p>
      )}

      {!loading && !error && requiredChecks.length === 0 && allChecksCount > 0 && (
        <p className="text-xs text-muted-foreground">
          No required checks — {allChecksCount} informational.
        </p>
      )}

      <ul className="space-y-2">
        {requiredChecks.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-sm">
            <CheckIcon run={c} />
            <span className="flex-1 truncate">{c.name}</span>
            {c.conclusion === "failure" && c.detailsUrl && (
              <a
                href={c.detailsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
              >
                Logs <ExternalLink className="size-3" />
              </a>
            )}
          </li>
        ))}
      </ul>

      {allChecksCount > requiredChecks.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          +{allChecksCount - requiredChecks.length} informational checks
        </p>
      )}
    </div>
  );
}
