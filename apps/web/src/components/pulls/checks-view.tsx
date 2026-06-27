"use client";

import { Badge } from "@/components/reui/badge";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  fetchCheckRunDetails,
  fetchJobLogs,
  fetchPullRequest,
  fetchPullRequestChecks,
} from "@/lib/github/pulls";
import type { CheckRunDetail, CheckStep, PRCheckRun } from "@/lib/github/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckIcon,
  ChevronRight,
  ChevronRightIcon,
  CircleIcon,
  ExternalLink,
  MinusIcon,
  XIcon,
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
    return <Spinner className="size-4 shrink-0 text-muted-foreground" />;
  if (
    run.conclusion === "success" ||
    run.conclusion === "neutral" ||
    run.conclusion === "skipped"
  )
    return <CheckIcon className="size-4 shrink-0 text-green-500" />;
  if (
    run.conclusion === "failure" ||
    run.conclusion === "timed_out" ||
    run.conclusion === "action_required"
  )
    return <XIcon className="size-4 shrink-0 text-destructive" />;
  return <CircleIcon className="size-4 shrink-0 text-muted-foreground" />;
}

function WorkflowStatusIcon({ group }: { group: WorkflowGroup }) {
  if (group.overallStatus === "failure")
    return <XIcon className="size-4 shrink-0 text-destructive" />;
  if (group.overallStatus === "in_progress")
    return <Spinner className="size-4 shrink-0 text-muted-foreground" />;
  if (group.overallStatus === "success")
    return <CheckIcon className="size-4 shrink-0 text-green-500" />;
  return <CircleIcon className="size-4 shrink-0 text-muted-foreground" />;
}

function stepTimelineStatus(step: CheckStep): "completed" | "active" | "pending" | "skipped" | "failed" {
  if (step.status !== "completed") return "active";
  if (step.conclusion === "success" || step.conclusion === "neutral") return "completed";
  if (step.conclusion === "skipped" || step.conclusion === "cancelled") return "skipped";
  if (step.conclusion === "failure" || step.conclusion === "timed_out" || step.conclusion === "action_required") return "failed";
  return "pending";
}

const stepIndicatorVariants: Record<ReturnType<typeof stepTimelineStatus>, string> = {
  completed: "bg-success/10 !border-success/20 text-success",
  active:    "bg-info/10 !border-info/20 text-info",
  failed:    "bg-destructive/10 !border-destructive/20 text-destructive",
  skipped:   "bg-muted/10 !border-muted/20 text-muted-foreground opacity-50",
  pending:   "bg-muted/40 !border-muted-foreground/20 text-muted-foreground/50",
};

function StepIndicatorIcon({ status }: { status: ReturnType<typeof stepTimelineStatus> }) {
  if (status === "completed") return <CheckIcon className="size-3" />;
  if (status === "active") return <Spinner className="size-3" />;
  if (status === "failed") return <XIcon className="size-3" />;
  if (status === "skipped") return <MinusIcon className="size-3" />;
  return <CircleIcon className="size-2.5 fill-current" />;
}

function StepBadge({ status, duration }: { status: ReturnType<typeof stepTimelineStatus>; duration: string | null }) {
  if (!duration && status === "pending") return null;
  const variant =
    status === "completed" ? "success-light" :
    status === "active" ? "info-light" :
    status === "failed" ? "destructive-light" :
    "warning-light";
  return (
    <Badge variant={variant} size="sm">
      {status === "active" ? "Running" : status === "pending" ? "Pending" : (duration ?? status)}
    </Badge>
  );
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
            <Button
              variant="ghost"
              onClick={() => onSelect({ kind: "workflow", runId: group.runId })}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted/60",
                isWorkflowSelected && "bg-muted",
                hasSelectedJob && !isWorkflowSelected && "text-foreground",
              )}
            >
              <WorkflowStatusIcon group={group} />
              <span className="flex-1 truncate">{group.name}</span>
            </Button>
            {group.checks.map((check) => {
              const isSelected =
                selection?.kind === "job" && selection.checkId === check.id;
              return (
                <Button
                  variant="ghost"
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
                </Button>
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
          <Button
            variant="ghost"
            key={check.id}
            onClick={() => onSelect({ kind: "job", checkId: check.id })}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
              isSelected && "bg-muted",
            )}
          >
            <CheckStatusIcon run={check} />
            <span className="flex-1 truncate">{check.name}</span>
          </Button>
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
        <Button
          variant="ghost"
          key={check.id}
          onClick={() => onSelectJob(check.id)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        >
          <CheckStatusIcon run={check} />
          <span className="flex-1 text-sm">{check.name}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
        </Button>
      ))}
    </div>
  );
}

// ─── Job View ─────────────────────────────────────────────────────────────────

function JobView({
  detail,
  logs,
  logsLoading,
}: {
  detail: CheckRunDetail;
  logs: Record<string, string>;
  logsLoading: boolean;
}) {
  const duration = formatDuration(detail.startedAt, detail.completedAt);

  if (detail.steps.length > 0) {
    const lastCompletedStep = detail.steps.reduce(
      (last, step) =>
        step.status === "completed" && step.number > last ? step.number : last,
      0,
    );

    return (
      <div className="flex flex-col gap-4">
        {duration && (
          <p className="text-xs text-muted-foreground">Total: {duration}</p>
        )}
        <Timeline defaultValue={lastCompletedStep}>
          {detail.steps.map((step) => {
            const status = stepTimelineStatus(step);
            const stepDuration = formatDuration(step.startedAt, step.completedAt);
            const stepLog = logs[step.name];
            const defaultOpen = status === "active" || status === "failed";
            return (
              <TimelineItem key={step.number} step={step.number} className="ms-10 pb-8">
                <TimelineHeader>
                  <TimelineSeparator className="bg-muted! group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
                  <div className="flex items-center gap-2">
                    <TimelineTitle className={cn(status === "skipped" && "opacity-50")}>
                      {step.name}
                    </TimelineTitle>
                    <StepBadge status={status} duration={stepDuration} />
                  </div>
                  <TimelineIndicator className={cn("flex size-6 items-center justify-center border-none group-data-[orientation=vertical]/timeline:-left-7", stepIndicatorVariants[status])}>
                    <StepIndicatorIcon status={status} />
                  </TimelineIndicator>
                </TimelineHeader>
                {detail.actionsJobId !== null && (
                  <TimelineContent className="mt-2">
                    <Frame className="overflow-hidden gap-0 p-0">
                      <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
                        <CollapsibleTrigger className="flex w-full">
                          <FrameHeader className="flex grow flex-row items-center justify-between gap-2 px-3 py-2">
                            <span className="text-xs text-muted-foreground">Logs</span>
                            <ChevronRightIcon className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                          </FrameHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <FramePanel className="rounded-none border-x-0 border-b-0 shadow-none p-0">
                            {logsLoading ? (
                              <div className="space-y-1.5 p-3">
                                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-3 w-full" />)}
                              </div>
                            ) : stepLog ? (
                              <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                                {stepLog}
                              </pre>
                            ) : (
                              <p className="p-3 text-xs text-muted-foreground">No logs for this step.</p>
                            )}
                          </FramePanel>
                        </CollapsibleContent>
                      </Collapsible>
                    </Frame>
                  </TimelineContent>
                )}
              </TimelineItem>
            );
          })}
        </Timeline>
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

  const { data: jobLogs = {}, isLoading: logsLoading } = useSWR(
    detail?.actionsJobId ? [owner, repo, detail.actionsJobId, "job-logs"] : null,
    ([o, r, id]) => fetchJobLogs(o, r, id),
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
                <Button
                  variant="link"
                  onClick={() =>
                    setSelection({ kind: "workflow", runId: selectedWorkflow.runId })
                  }
                  className="h-auto shrink-0 p-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {selectedWorkflow.name}
                </Button>
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
              {!detailLoading && detail && <JobView detail={detail} logs={jobLogs} logsLoading={logsLoading} />}
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
