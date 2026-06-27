"use client";

import type { VerdictState } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  CircleDot,
  GitMerge,
  XCircle,
  X,
} from "lucide-react";

const STATUS_CONFIG: Record<
  VerdictState["status"],
  { label: string; icon: React.ReactNode; className: string }
> = {
  READY: {
    label: "Ready to merge",
    icon: <CheckCircle2 className="size-5 text-green-500" />,
    className: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950",
  },
  NOT_READY: {
    label: "Not ready",
    icon: <XCircle className="size-5 text-destructive" />,
    className: "border-destructive/30 bg-destructive/5",
  },
  MERGED: {
    label: "Merged",
    icon: <GitMerge className="size-5 text-purple-500" />,
    className: "border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950",
  },
  DRAFT: {
    label: "Draft — not requesting review",
    icon: <CircleDot className="size-5 text-muted-foreground" />,
    className: "",
  },
  CLOSED: {
    label: "Closed",
    icon: <X className="size-5 text-muted-foreground" />,
    className: "",
  },
};

export interface ZoneVerdictProps {
  verdict: VerdictState | null;
  loading: boolean;
  error: boolean;
}

export function ZoneVerdict({ verdict, loading, error }: ZoneVerdictProps) {
  if (error) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm text-destructive">
        Could not compute merge readiness.{" "}
        <button className="underline" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (loading || !verdict) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  const config = STATUS_CONFIG[verdict.status];

  return (
    <div className={`rounded-lg border bg-card p-4 ${config.className}`}>
      <div className="flex items-center gap-2">
        {config.icon}
        <span className="font-semibold">{config.label}</span>
      </div>

      {verdict.blockers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-muted-foreground">Blocking:</span>
          {verdict.blockers.map((b, i) => (
            <span key={i} className="flex items-center gap-1 text-destructive">
              <XCircle className="size-3.5 shrink-0" />
              {b.label}
            </span>
          ))}
        </div>
      )}

      {verdict.notables.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {verdict.notables.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
      )}
    </div>
  );
}
