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
  ChevronRight,
  CircleDot,
  ExternalLink,
  Loader2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR from "swr";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowGroup {
  runId: number;
  name: string;
  checks: PRCheckRun[];
  overallStatus: "success" | "failure" | "in_progress" | "other";
}

interface CheckGroups {
  workflows: WorkflowGroup[];
  standalone: PRCheckRun[];
}

type Selection =
  | { kind: "workflow"; runId: number }
  | { kind: "job"; checkId: number };

// ─── Grouping ─────────────────────────────────────────────────────────────────

function groupChecks(checks: PRCheckRun[]): CheckGroups {
  const workflowMap = new Map<number, WorkflowGroup>();
  const standalone: PRCheckRun[] = [];

  for (const check of checks) {
    if (check.workflowRunId !== null) {
      if (!workflowMap.has(check.workflowRunId)) {
        workflowMap.set(check.workflowRunId, {
          runId: check.workflowRunId,
          name: check.workflowName ?? `Run #${check.workflowRunId}`,
          checks: [],
          overallStatus: "other",
        });
      }
      workflowMap.get(check.workflowRunId)!.checks.push(check);
    } else {
      standalone.push(check);
    }
  }

  for (const group of workflowMap.values()) {
    const hasFailure = group.checks.some(
      (c) =>
        c.conclusion === "failure" ||
        c.conclusion === "timed_out" ||
        c.conclusion === "action_required",
    );
    const hasInProgress = group.checks.some((c) => c.status !== "completed");
    const allSuccess = group.checks.every(
      (c) =>
        c.status === "completed" &&
        (c.conclusion === "success" ||
          c.conclusion === "neutral" ||
          c.conclusion === "skipped"),
    );
    group.overallStatus = hasFailure
      ? "failure"
      : hasInProgress
        ? "in_progress"
        : allSuccess
          ? "success"
          : "other";
  }

  return { workflows: [...workflowMap.values()], standalone };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TreeConnector() {
  return (
    <svg
      viewBox="0 0 12 16"
      width={12}
      height={16}
      className="shrink-0 stroke-muted-foreground/30"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 0 v9 a1 1 0 0 0 1 1 h5" />
    </svg>
  );
}

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

function WorkflowStatusIcon({ group }: { group: WorkflowGroup }) {
  if (group.overallStatus === "failure")
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  if (group.overallStatus === "in_progress")
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  if (group.overallStatus === "success")
    return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
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
  groups,
  selection,
  onSelect,
}: {
  groups: CheckGroups;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  return (
    <div className="px-2 py-2">
      {groups.workflows.map((group) => {
        const isWorkflowSelected =
          selection?.kind === "workflow" && selection.runId === group.runId;
        const hasSelectedJob =
          selection?.kind === "job" &&
          group.checks.some((c) => c.id === selection.checkId);

        return (
          <div key={group.runId} className="mb-1">
            <button
              onClick={() => onSelect({ kind: "workflow", runId: group.runId })}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted/60",
                isWorkflowSelected && "bg-muted",
                hasSelectedJob && !isWorkflowSelected && "text-foreground",
              )}
            >
              <WorkflowStatusIcon group={group} />
              <span className="flex-1 truncate">{group.name}</span>
            </button>
            {group.checks.map((check) => {
              const isSelected =
                selection?.kind === "job" && selection.checkId === check.id;
              return (
                <button
                  key={check.id}
                  onClick={() => onSelect({ kind: "job", checkId: check.id })}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-left text-sm transition-colors hover:bg-muted/60",
                    isSelected && "bg-muted",
                  )}
                >
                  <TreeConnector />
                  <CheckStatusIcon run={check} />
                  <span className="flex-1 truncate">{check.name}</span>
                </button>
              );
            })}
          </div>
        );
      })}

      {groups.workflows.length > 0 && groups.standalone.length > 0 && (
        <div className="my-1 border-t" />
      )}

      {groups.standalone.map((check) => {
        const isSelected =
          selection?.kind === "job" && selection.checkId === check.id;
        return (
          <button
            key={check.id}
            onClick={() => onSelect({ kind: "job", checkId: check.id })}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
              isSelected && "bg-muted",
            )}
          >
            <CheckStatusIcon run={check} />
            <span className="flex-1 truncate">{check.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Workflow View ────────────────────────────────────────────────────────────

function WorkflowView({
  group,
  onSelectJob,
}: {
  group: WorkflowGroup;
  onSelectJob: (checkId: number) => void;
}) {
  return (
    <div className="divide-y rounded-lg border">
      {group.checks.map((check) => (
        <button
          key={check.id}
          onClick={() => onSelectJob(check.id)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        >
          <CheckStatusIcon run={check} />
          <span className="flex-1 text-sm">{check.name}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
        </button>
      ))}
    </div>
  );
}

// ─── Job View ─────────────────────────────────────────────────────────────────

function JobView({ detail }: { detail: CheckRunDetail }) {
  const duration = formatDuration(detail.startedAt, detail.completedAt);

  if (detail.steps.length > 0) {
    return (
      <div className="flex flex-col">
        {duration && (
          <p className="mb-4 text-xs text-muted-foreground">Total: {duration}</p>
        )}
        <ol className="relative ml-2 border-l border-border">
          {detail.steps.map((step) => {
            const stepDuration = formatDuration(step.startedAt, step.completedAt);
            const isSkipped =
              step.conclusion === "skipped" || step.conclusion === "cancelled";
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
        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
        </div>
      )}
      {text && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
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
  const [selection, setSelection] = useState<Selection | null>(null);

  const { data: pr } = useSWR(
    [owner, repo, prNumber, "pr"],
    ([o, r, n]) => fetchPullRequest(o, r, n),
  );

  const { data: checks = [], isLoading: checksLoading } = useSWR(
    pr ? [owner, repo, pr.headSha, pr.baseRef, "checks"] : null,
    ([o, r, sha, base]) => fetchPullRequestChecks(o, r, sha, base),
  );

  const groups = useMemo(() => groupChecks(checks), [checks]);

  const defaultSelection = useMemo((): Selection | null => {
    if (groups.workflows.length > 0) {
      const failing = groups.workflows.find((g) => g.overallStatus === "failure");
      return { kind: "workflow", runId: (failing ?? groups.workflows[0]).runId };
    }
    if (groups.standalone.length > 0) {
      return { kind: "job", checkId: groups.standalone[0].id };
    }
    return null;
  }, [groups]);

  const effectiveSelection = selection ?? defaultSelection;

  const selectedCheckId =
    effectiveSelection?.kind === "job" ? effectiveSelection.checkId : null;

  const { data: detail, isLoading: detailLoading } = useSWR(
    selectedCheckId !== null ? [owner, repo, selectedCheckId, "check-detail"] : null,
    ([o, r, id]) => fetchCheckRunDetails(o, r, id),
  );

  const selectedCheck =
    selectedCheckId !== null
      ? (checks.find((c) => c.id === selectedCheckId) ?? null)
      : null;

  const selectedWorkflow =
    effectiveSelection?.kind === "workflow"
      ? (groups.workflows.find((g) => g.runId === effectiveSelection.runId) ?? null)
      : selectedCheck?.workflowRunId !== null && selectedCheck?.workflowRunId !== undefined
        ? (groups.workflows.find((g) => g.runId === selectedCheck.workflowRunId) ?? null)
        : null;

  const externalUrl =
    effectiveSelection?.kind === "workflow" && selectedWorkflow
      ? `https://github.com/${owner}/${repo}/actions/runs/${selectedWorkflow.runId}`
      : (selectedCheck?.detailsUrl || null);

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r md:block">
        {checksLoading ? (
          <div className="space-y-1.5 p-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-7 w-full" />)}
          </div>
        ) : (
          <CheckList
            groups={groups}
            selection={effectiveSelection}
            onSelect={setSelection}
          />
        )}
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Link
            href={`/${owner}/${repo}/pulls/${prNumber}`}
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to PR #{prNumber}
          </Link>

          {selectedWorkflow && (
            <>
              <span className="text-xs text-muted-foreground/40">/</span>
              {effectiveSelection?.kind === "job" ? (
                <button
                  onClick={() =>
                    setSelection({ kind: "workflow", runId: selectedWorkflow.runId })
                  }
                  className="shrink-0 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  {selectedWorkflow.name}
                </button>
              ) : (
                <span className="truncate text-xs font-medium">
                  {selectedWorkflow.name}
                </span>
              )}
            </>
          )}

          {selectedCheck && (
            <>
              <span className="text-xs text-muted-foreground/40">/</span>
              <span className="truncate text-xs font-medium">{selectedCheck.name}</span>
            </>
          )}

          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              View logs <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6 [scrollbar-gutter:stable]">
          {effectiveSelection?.kind === "workflow" && selectedWorkflow && (
            <WorkflowView
              group={selectedWorkflow}
              onSelectJob={(checkId) => setSelection({ kind: "job", checkId })}
            />
          )}

          {effectiveSelection?.kind === "job" && (
            <>
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
              {!detailLoading && detail && <JobView detail={detail} />}
              {!detailLoading && !detail && (
                <p className="text-sm text-muted-foreground">
                  Failed to load check details.
                </p>
              )}
            </>
          )}

          {!effectiveSelection && !checksLoading && (
            <p className="text-sm text-muted-foreground">
              Select a check to view its execution graph.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
