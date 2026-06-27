"use client";

import type { PullRequest, VerdictState } from "@/lib/github/types";
import {
  closePullRequest,
  mergePullRequest,
  reopenPullRequest,
  updateBranch,
} from "@/lib/github/pulls-actions";
import { useUndoAction } from "@/hooks/use-undo-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  CircleDot,
  GitMerge,
  Loader2,
  RefreshCw,
  XCircle,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

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

const MERGE_METHODS = [
  { value: "merge", label: "Merge commit", description: "All commits merged with a merge commit" },
  { value: "squash", label: "Squash and merge", description: "All commits squashed into one" },
  { value: "rebase", label: "Rebase and merge", description: "All commits rebased onto base" },
] as const;

export interface ZoneVerdictProps {
  pr: PullRequest | null;
  verdict: VerdictState | null;
  loading: boolean;
  error: boolean;
}

export function ZoneVerdict({ pr, verdict, loading, error }: ZoneVerdictProps) {
  const { mutate } = useSWRConfig();
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2] ? parseInt(params.rest[2], 10) : undefined;

  const [mergeMethod, setMergeMethod] = useState<"merge" | "squash" | "rebase">("merge");
  const [commitTitle, setCommitTitle] = useState("");
  const [merging, setMerging] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const undoAction = useUndoAction();

  const invalidatePR = () => {
    if (!owner || !repo || !prNumber) return;
    mutate([owner, repo, prNumber, "pr"]);
    mutate([owner, repo, prNumber, "activity"]);
  };

  const handleMerge = async () => {
    if (!owner || !repo || !prNumber) return;
    setMerging(true);
    setMergeError(null);
    const result = await mergePullRequest(
      owner, repo, prNumber, mergeMethod,
      mergeMethod === "merge" && commitTitle ? commitTitle : undefined,
    );
    setMerging(false);
    if (result.success) {
      invalidatePR();
    } else {
      setMergeError(result.error ?? "Merge failed");
    }
  };

  const handleClose = async () => {
    if (!owner || !repo || !prNumber) return;
    await closePullRequest(owner, repo, prNumber);
    invalidatePR();
    undoAction.trigger("PR closed", async () => {
      await reopenPullRequest(owner, repo, prNumber);
      invalidatePR();
    });
  };

  const handleReopen = async () => {
    if (!owner || !repo || !prNumber) return;
    await reopenPullRequest(owner, repo, prNumber);
    invalidatePR();
  };

  const handleUpdateBranch = async () => {
    if (!owner || !repo || !prNumber) return;
    setUpdating(true);
    await updateBranch(owner, repo, prNumber);
    setUpdating(false);
    mutate([owner, repo, prNumber, "pr"]);
  };

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
  const showMerge = pr?.state === "open" || pr?.state === "draft";
  const canMerge = showMerge && pr?.mergeableState === "mergeable";
  const canClose = pr?.state === "open" || pr?.state === "draft";
  const canReopen = pr?.state === "closed";
  const isBehind = pr?.state === "open" && pr.behindBy > 0;

  return (
    <div className={`rounded-lg border bg-card p-4 ${config.className}`}>
      {/* Header: status + action buttons */}
      <div className="flex items-center gap-2">
        {config.icon}
        <span className="flex-1 font-semibold">{config.label}</span>

        {/* Action buttons — top-right, link-styled */}
        <div className="ml-auto flex items-center gap-3 text-xs">
          {isBehind && (
            <button
              onClick={handleUpdateBranch}
              disabled={updating}
              className="flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors disabled:opacity-50"
            >
              {updating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Update branch
            </button>
          )}

          {canReopen && (
            <button
              onClick={handleReopen}
              className="flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
            >
              <GitMerge className="size-3.5" />
              Reopen
            </button>
          )}

          {canClose && (
            <button
              onClick={handleClose}
              className="flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
            >
              <X className="size-3.5" />
              Close
            </button>
          )}

          {showMerge && (
            <Dialog>
              <DialogTrigger
                render={
                  <button
                    disabled={!canMerge}
                    className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                  />
                }
              >
                <GitMerge className="size-3.5" />
                Merge
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Merge pull request</DialogTitle>
                </DialogHeader>

                <div className="space-y-2">
                  {MERGE_METHODS.map((m) => (
                    <label
                      key={m.value}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-foreground"
                    >
                      <input
                        type="radio"
                        name="merge-method"
                        value={m.value}
                        checked={mergeMethod === m.value}
                        onChange={() => setMergeMethod(m.value)}
                        className="mt-0.5 shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {mergeMethod === "merge" && (
                  <input
                    type="text"
                    placeholder="Commit title (optional)"
                    value={commitTitle}
                    onChange={(e) => setCommitTitle(e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
                  />
                )}

                {mergeError && (
                  <p className="text-xs text-destructive">{mergeError}</p>
                )}

                <DialogFooter showCloseButton>
                  <Button
                    onClick={handleMerge}
                    disabled={merging || !canMerge}
                    className="gap-2"
                  >
                    {merging && <Loader2 className="size-4 animate-spin" />}
                    Confirm merge
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
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

      {/* Undo banner for close */}
      {undoAction.pending && (
        <div className="mt-3 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
          <span className="text-muted-foreground">{undoAction.pending.label}</span>
          <button
            onClick={undoAction.undo}
            className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
