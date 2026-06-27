"use client";

import type { PullRequest } from "@/lib/github/types";
import { updatePullRequestBody } from "@/lib/github/pulls-actions";
import { formatTimeAgo } from "@/lib/time";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronToggle } from "@/components/ui/chevron-toggle";
import {
  CircleDot,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

function StateIcon({ state }: { state: PullRequest["state"] }) {
  if (state === "merged")
    return <GitMerge className="mt-0.5 size-5 shrink-0 text-purple-500" />;
  if (state === "closed")
    return (
      <GitPullRequestClosed className="mt-0.5 size-5 shrink-0 text-red-500" />
    );
  if (state === "draft")
    return (
      <CircleDot className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
    );
  return (
    <GitPullRequest className="mt-0.5 size-5 shrink-0 text-green-500" />
  );
}

export interface ZoneIdentityProps {
  pr: PullRequest | null;
  loading: boolean;
  error: boolean;
}

export function ZoneIdentity({ pr, loading, error }: ZoneIdentityProps) {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2] ? parseInt(params.rest[2], 10) : undefined;
  const { mutate } = useSWRConfig();

  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [optimisticBody, setOptimisticBody] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const runSave = async (body: string) => {
    if (!owner || !repo || !prNumber) return;
    setOptimisticBody(body);
    setSaveError(null);
    setSaving(true);
    const result = await updatePullRequestBody(owner, repo, prNumber, body);
    setSaving(false);
    if (result.success) {
      setOptimisticBody(null);
      mutate([owner, repo, prNumber, "pr"]);
    } else {
      setOptimisticBody(null);
      setSaveError(result.error ?? "Save failed");
    }
  };

  const handleEdit = () => {
    setDraftBody(optimisticBody ?? pr?.body ?? "");
    setSaveError(null);
    setBodyExpanded(true);
    setEditMode(true);
  };

  const handleSave = () => {
    setEditMode(false);
    void runSave(draftBody);
  };

  const displayBody = optimisticBody ?? pr?.body ?? "";

  if (error) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm text-destructive">
        Could not load PR details.{" "}
        <button
          className="underline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !pr) {
    return (
      <div className="flex gap-3 rounded-lg border bg-card p-4">
        <Skeleton className="mt-0.5 size-5 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Title row */}
      <div className="flex items-start gap-3">
        <StateIcon state={pr.state} />
        <h1 className="min-w-0 flex-1 text-base font-semibold leading-snug">
          {pr.title}{" "}
          <span className="font-normal text-muted-foreground">#{pr.number}</span>
        </h1>
        <div className="mt-0.5 flex shrink-0 items-center gap-2">
          {editMode ? (
            <button
              onClick={handleSave}
              className="text-xs text-foreground underline-offset-2 transition-colors hover:text-muted-foreground hover:underline"
            >
              Save
            </button>
          ) : (
            <button
              onClick={handleEdit}
              disabled={saving}
              className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-40"
            >
              {saving ? "Saving…" : "Edit"}
            </button>
          )}
          {!editMode && displayBody && (
            <button
              onClick={() => setBodyExpanded((v) => !v)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={bodyExpanded ? "Collapse description" : "Expand description"}
            >
              <ChevronToggle open={bodyExpanded} className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-2 space-y-0.5 pl-8 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{pr.author.login}</span>
          {" wants to merge "}
          <code className="rounded bg-muted px-1 text-xs">{pr.headRef}</code>
          {" → "}
          <code className="rounded bg-muted px-1 text-xs">{pr.baseRef}</code>
        </p>
        <p>
          {pr.commitCount} {pr.commitCount === 1 ? "commit" : "commits"}
          {" · opened "}
          {formatTimeAgo(pr.createdAt)}
          {pr.updatedAt !== pr.createdAt && (
            <> · updated {formatTimeAgo(pr.updatedAt)}</>
          )}
        </p>
      </div>

      {/* Labels */}
      {pr.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 pl-8">
          {pr.labels.map((l) => (
            <span
              key={l.name}
              className="rounded-full border px-2 py-0.5 text-xs font-medium"
              style={{ borderColor: `#${l.color}`, color: `#${l.color}` }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Body — editor or accordion */}
      {editMode && (
        <div className="mt-3 border-t pt-3 pl-8">
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            style={{ minHeight: "120px" }}
            placeholder="Leave a description…"
          />
        </div>
      )}

      {!editMode && displayBody && bodyExpanded && (
        <div className="mt-3 border-t pt-3 pl-8">
          <div className={`prose prose-sm dark:prose-invert max-w-none text-sm${optimisticBody !== null ? " opacity-60" : ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayBody}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <p className="mt-2 pl-8 text-xs text-destructive">
          {saveError}.{" "}
          <button
            onClick={() => void runSave(draftBody)}
            className="underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
