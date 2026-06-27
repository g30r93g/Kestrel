"use client";

import {
  fetchCheckRunDetails,
  fetchPullRequest,
  fetchPullRequestChecks,
} from "@/lib/github/pulls";
import type { CheckRunDetail, CheckStep, PRCheckRun } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Loader2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckStatusIcon({ run }: { run: PRCheckRun }) {
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

function StepIcon({ step }: { step: CheckStep }) {
  if (step.status !== "completed")
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  if (step.conclusion === "success")
    return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
  if (step.conclusion === "failure" || step.conclusion === "timed_out")
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  if (step.conclusion === "skipped" || step.conclusion === "cancelled")
    return <MinusCircle className="size-4 shrink-0 text-muted-foreground/60" />;
  return <CircleDot className="size-4 shrink-0 text-muted-foreground" />;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function CheckList({
  checks,
  selectedId,
  onSelect,
}: {
  checks: PRCheckRun[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const required = checks.filter((c) => c.isRequired);
  const informational = checks.filter((c) => !c.isRequired);

  const renderCheck = (c: PRCheckRun) => (
    <button
      key={c.id}
      onClick={() => onSelect(c.id)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
        selectedId === c.id && "bg-muted",
      )}
    >
      <CheckStatusIcon run={c} />
      <span className="flex-1 truncate">{c.name}</span>
    </button>
  );

  return (
    <div className="px-2 py-2">
      {required.length > 0 && (
        <>
          {required.map(renderCheck)}
          {informational.length > 0 && (
            <p className="mt-2 mb-1 px-2 text-xs text-muted-foreground">Informational</p>
          )}
        </>
      )}
      {informational.map(renderCheck)}
    </div>
  );
}

// ─── Execution Graph ──────────────────────────────────────────────────────────

function ExecutionGraph({ detail }: { detail: CheckRunDetail }) {
  const duration = formatDuration(detail.startedAt, detail.completedAt);

  if (detail.steps.length > 0) {
    return (
      <div className="flex flex-col">
        {duration && (
          <p className="mb-4 text-xs text-muted-foreground">
            Total: {duration}
          </p>
        )}
        <ol className="relative border-l border-border ml-2">
          {detail.steps.map((step) => {
            const stepDuration = formatDuration(step.startedAt, step.completedAt);
            const isSkipped = step.conclusion === "skipped" || step.conclusion === "cancelled";
            return (
              <li key={step.number} className="mb-4 ml-4 last:mb-0">
                <div className="absolute -left-2 flex items-center justify-center">
                  <StepIcon step={step} />
                </div>
                <div className={cn("flex items-baseline gap-2", isSkipped && "opacity-50")}>
                  <span className="text-sm">{step.name}</span>
                  {stepDuration && (
                    <span className="text-xs text-muted-foreground">{stepDuration}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const { title, summary, text } = detail.output;
  if (!title && !summary && !text) {
    return (
      <p className="text-sm text-muted-foreground">
        No execution details available for this check.{" "}
        {detail.detailsUrl && (
          <a
            href={detail.detailsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
          >
            View on GitHub <ExternalLink className="size-3" />
          </a>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {title && <h3 className="font-medium">{title}</h3>}
      {summary && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{summary}</p>
      )}
      {text && (
        <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">{text}</pre>
      )}
    </div>
  );
}

// ─── Top-level View ───────────────────────────────────────────────────────────

interface ChecksViewProps {
  owner: string;
  repo: string;
  prNumber: number;
}

export function ChecksView({ owner, repo, prNumber }: ChecksViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: pr } = useSWR(
    [owner, repo, prNumber, "pr"],
    ([o, r, n]) => fetchPullRequest(o, r, n),
  );

  const { data: checks = [], isLoading: checksLoading } = useSWR(
    pr ? [owner, repo, pr.headSha, pr.baseRef, "checks"] : null,
    ([o, r, sha, base]) => fetchPullRequestChecks(o, r, sha, base),
  );

  const effectiveId = selectedId ?? checks[0]?.id ?? null;

  const { data: detail, isLoading: detailLoading } = useSWR(
    effectiveId !== null ? [owner, repo, effectiveId, "check-detail"] : null,
    ([o, r, id]) => fetchCheckRunDetails(o, r, id),
  );

  const selectedCheck = checks.find((c) => c.id === effectiveId) ?? null;

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* Check list sidebar */}
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r md:block">
        {checksLoading ? (
          <div className="space-y-1.5 p-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-7 w-full" />)}
          </div>
        ) : (
          <CheckList
            checks={checks}
            selectedId={effectiveId}
            onSelect={setSelectedId}
          />
        )}
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Link
            href={`/${owner}/${repo}/pulls/${prNumber}`}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to PR #{prNumber}
          </Link>
          {selectedCheck && (
            <>
              <span className="text-xs text-muted-foreground/40">/</span>
              <span className="truncate text-xs font-medium">{selectedCheck.name}</span>
              {selectedCheck.detailsUrl && (
                <a
                  href={selectedCheck.detailsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  View logs <ExternalLink className="size-3" />
                </a>
              )}
            </>
          )}
        </div>

        {/* Execution graph */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6 [scrollbar-gutter:stable]">
          {detailLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          )}
          {!detailLoading && detail && <ExecutionGraph detail={detail} />}
          {!detailLoading && !detail && effectiveId && (
            <p className="text-sm text-muted-foreground">Failed to load check details.</p>
          )}
          {!detailLoading && !effectiveId && (
            <p className="text-sm text-muted-foreground">Select a check to view its execution graph.</p>
          )}
        </div>
      </div>
    </div>
  );
}
