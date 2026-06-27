"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { submitReview, createFileComment } from "@/lib/github/pulls-actions";
import { useReviewDraft } from "@/components/pulls/review-draft-context";

type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

const EVENT_BUTTONS: { value: ReviewEvent; label: string }[] = [
  { value: "APPROVE", label: "Approve" },
  { value: "REQUEST_CHANGES", label: "Request changes" },
  { value: "COMMENT", label: "Comment" },
];

interface ReviewBarProps {
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
  enabled?: boolean;
}

export function ReviewBar({ owner, repo, prNumber, commitSha, enabled = true }: ReviewBarProps) {
  const { draft, setBody, clearDraft } = useReviewDraft();
  const router = useRouter();
  const [event, setEvent] = useState<ReviewEvent>("COMMENT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  const lineComments = draft.comments.filter((c) => !c.isFileLevel);
  const fileComments = draft.comments.filter((c) => c.isFileLevel);
  const totalCount = draft.comments.length;

  const handleSubmit = async () => {
    if (!commitSha) return;
    if (event === "REQUEST_CHANGES" && !draft.body.trim()) {
      setError("A comment is required when requesting changes.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const apiComments = lineComments.map((c) => ({
      path: c.path,
      line: c.line,
      ...(c.startLine !== undefined ? { start_line: c.startLine } : {}),
      side: c.side,
      ...(c.startSide !== undefined ? { start_side: c.startSide } : {}),
      body: c.quotedText ? `> ${c.quotedText}\n\n${c.body}` : c.body,
    }));

    const result = await submitReview(
      owner,
      repo,
      prNumber,
      draft.body,
      event,
      commitSha,
      apiComments,
    );

    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? "Submission failed");
      return;
    }

    // Post file-level comments sequentially (not part of createReview batch)
    const fileErrors: string[] = [];
    for (const fc of fileComments) {
      const fcResult = await createFileComment(owner, repo, prNumber, commitSha, fc.path, fc.body);
      if (!fcResult.success) fileErrors.push(fc.path);
    }
    if (fileErrors.length > 0) {
      setSubmitting(false);
      setError(`Review submitted but ${fileErrors.length} file comment(s) failed: ${fileErrors.join(", ")}`);
      return;
    }

    clearDraft();
    router.push(`/${owner}/${repo}/pulls/${prNumber}`);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Comment / reviewed-file summary */}
        <span className="text-xs text-muted-foreground">
          {totalCount === 0
            ? "No pending comments"
            : `${totalCount} pending comment${totalCount > 1 ? "s" : ""}`}
        </span>
        {draft.markedFiles.length > 0 && (
          <span className="text-xs text-muted-foreground">
            · {draft.markedFiles.length} file{draft.markedFiles.length > 1 ? "s" : ""} reviewed
          </span>
        )}

        <div className="flex-1" />

        {/* Overall review body input */}
        <input
          type="text"
          placeholder={
            event === "APPROVE"
              ? "Optional comment…"
              : event === "REQUEST_CHANGES"
                ? "What needs to change? (required)"
                : "Overall comment…"
          }
          value={draft.body}
          onChange={(e) => setBody(e.target.value)}
          className="w-56 rounded-md border bg-background px-2.5 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {/* Event selector */}
        <div className="flex overflow-hidden rounded-lg border">
          {EVENT_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              onClick={() => {
                setEvent(btn.value);
                setError(null);
              }}
              className={[
                "border-r px-3 py-1.5 text-xs transition-colors last:border-r-0",
                event === btn.value
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !commitSha}
          className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-xs text-background transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          Submit review
        </button>
      </div>

      {error && <p className="px-4 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
