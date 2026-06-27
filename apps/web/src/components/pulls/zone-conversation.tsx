"use client";

import type { PRComment } from "@/lib/github/types";
import { addComment, deleteComment } from "@/lib/github/pulls-actions";
import { useUndoAction } from "@/hooks/use-undo-action";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/time";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PREVIEW_COUNT = 5;

export interface ZoneConversationProps {
  comments: PRComment[];
  loading: boolean;
  error: boolean;
}

export function ZoneConversation({ comments, loading, error }: ZoneConversationProps) {
  const { mutate } = useSWRConfig();
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2] ? parseInt(params.rest[2], 10) : undefined;

  const [showComposer, setShowComposer] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [optimisticComment, setOptimisticComment] = useState<PRComment | null>(null);
  const undoAction = useUndoAction();

  const invalidate = () => {
    if (!owner || !repo || !prNumber) return;
    mutate([owner, repo, prNumber, "comments"]);
    mutate([owner, repo, prNumber, "activity"]);
  };

  const handleSubmit = async () => {
    if (!owner || !repo || !prNumber || !body.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    const tempComment: PRComment = {
      id: -Date.now(), // temporary negative id
      author: { login: "…", avatarUrl: "" },
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    setOptimisticComment(tempComment);
    setBody("");
    setShowComposer(false);

    const result = await addComment(owner, repo, prNumber, tempComment.body);
    setSubmitting(false);

    if (result.success && result.commentId) {
      // Real id available — set up undo
      undoAction.trigger("Comment added", async () => {
        if (!owner || !repo || !result.commentId) return;
        setOptimisticComment(null);
        await deleteComment(owner, repo, result.commentId);
        invalidate();
      });
      // After undo window expires, refresh to get server-canonical state
      setTimeout(invalidate, 6200);
    } else {
      // Failed — roll back optimistic comment
      setOptimisticComment(null);
      setBody(tempComment.body); // restore body so user doesn't lose it
      setShowComposer(true);
      setSubmitError(result.error ?? "Could not post comment.");
    }
  };

  const allComments = [
    ...comments,
    ...(optimisticComment ? [optimisticComment] : []),
  ];
  const preview = allComments.slice(-PREVIEW_COUNT);
  const hiddenCount = Math.max(0, allComments.length - PREVIEW_COUNT);

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      {/* Header with action button */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Conversation</h2>
        <button
          onClick={() => setShowComposer((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
        >
          <MessageSquarePlus className="size-3.5" />
          Add comment
        </button>
      </div>

      {error && <p className="text-xs text-destructive">Comments unavailable.</p>}

      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && allComments.length === 0 && !showComposer && (
        <p className="text-xs text-muted-foreground">
          No discussion yet — start the conversation below.
        </p>
      )}

      {!loading && !error && allComments.length > 0 && (
        <ul className="flex flex-col gap-4">
          {hiddenCount > 0 && (
            <li className="text-xs text-muted-foreground">
              {hiddenCount} earlier comment{hiddenCount > 1 ? "s" : ""}
            </li>
          )}
          {preview.map((c) => (
            <li key={c.id} className={c.id < 0 ? "opacity-60" : undefined}>
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">@{c.author.login}</span>
                <span>·</span>
                <span>{formatTimeAgo(c.createdAt)}</span>
                {c.id < 0 && <span className="italic">Posting…</span>}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {c.body.length > 300 ? `${c.body.slice(0, 300)}…` : c.body}
                </ReactMarkdown>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Undo banner */}
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

      {/* Comment composer */}
      {showComposer && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <Textarea
            placeholder="Leave a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="text-sm"
          />
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowComposer(false); setSubmitError(null); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !body.trim()}
              className="gap-1.5"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
