"use client";

import type { PRReview } from "@/lib/github/types";
import { submitReview, requestReview } from "@/lib/github/pulls-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/time";
import {
  CheckCircle2,
  CircleDot,
  Loader2,
  MessageSquare,
  PenLine,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

function ReviewIcon({ state }: { state: PRReview["state"] }) {
  if (state === "APPROVED")
    return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
  if (state === "CHANGES_REQUESTED")
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  if (state === "DISMISSED")
    return <CircleDot className="size-4 shrink-0 text-muted-foreground" />;
  return <MessageSquare className="size-4 shrink-0 text-muted-foreground" />;
}

const STATE_LABEL: Record<PRReview["state"], string> = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  COMMENTED: "Commented",
  DISMISSED: "Dismissed",
  PENDING: "Pending",
};

type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface ZoneReviewsProps {
  reviews: PRReview[];
  loading: boolean;
  error: boolean;
}

export function ZoneReviews({ reviews, loading, error }: ZoneReviewsProps) {
  const { mutate } = useSWRConfig();
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2] ? parseInt(params.rest[2], 10) : undefined;

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewEvent, setReviewEvent] = useState<ReviewEvent>("COMMENT");
  const [requestLogin, setRequestLogin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => {
    if (!owner || !repo || !prNumber) return;
    mutate([owner, repo, prNumber, "reviews"]);
    mutate([owner, repo, prNumber, "activity"]);
  };

  const handleSubmitReview = async () => {
    if (!owner || !repo || !prNumber) return;
    if (reviewEvent === "REQUEST_CHANGES" && !reviewBody.trim()) {
      setFormError("A comment is required when requesting changes.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await submitReview(owner, repo, prNumber, reviewBody, reviewEvent);
    setSubmitting(false);
    if (result.success) {
      setReviewBody("");
      setReviewEvent("COMMENT");
      setShowReviewForm(false);
      invalidate();
    } else {
      setFormError(result.error ?? "Submission failed");
    }
  };

  const handleRequestReviewer = async () => {
    if (!owner || !repo || !prNumber || !requestLogin.trim()) return;
    setRequestSubmitting(true);
    const result = await requestReview(owner, repo, prNumber, [requestLogin.trim()]);
    setRequestSubmitting(false);
    if (result.success) {
      setRequestLogin("");
      setShowRequestForm(false);
      invalidate();
    }
  };

  // Collapse to latest review per human reviewer
  const latestByReviewer = new Map<string, PRReview>();
  for (const r of reviews.filter((r) => !r.isAutomated)) {
    const existing = latestByReviewer.get(r.reviewer.login);
    if (!existing || (r.submittedAt ?? "") > (existing.submittedAt ?? "")) {
      latestByReviewer.set(r.reviewer.login, r);
    }
  }
  const humanReviews = [...latestByReviewer.values()];
  const latestAutomated = new Map<string, PRReview>();
  for (const r of reviews.filter((r) => r.isAutomated)) {
    if (!latestAutomated.has(r.reviewer.login)) latestAutomated.set(r.reviewer.login, r);
  }
  const automatedReviews = [...latestAutomated.values()];

  const EVENT_BUTTONS: { value: ReviewEvent; label: string }[] = [
    { value: "APPROVE", label: "Approve" },
    { value: "REQUEST_CHANGES", label: "Request changes" },
    { value: "COMMENT", label: "Comment" },
  ];

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header with action buttons */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Reviews</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowRequestForm((v) => !v); setShowReviewForm(false); }}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
          >
            <UserPlus className="size-3.5" />
            Request reviewer
          </button>
          <button
            onClick={() => { setShowReviewForm((v) => !v); setShowRequestForm(false); }}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
          >
            <PenLine className="size-3.5" />
            Add review
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">Reviews unavailable.</p>}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {!loading && !error && humanReviews.length === 0 && (
        <p className="text-xs text-muted-foreground">No reviewers yet.</p>
      )}

      <ul className="space-y-2">
        {humanReviews.map((r) => (
          <li key={r.reviewer.login} className="flex items-center gap-2 text-sm">
            <ReviewIcon state={r.state} />
            <span className="font-medium">@{r.reviewer.login}</span>
            <span className="text-muted-foreground">{STATE_LABEL[r.state]}</span>
            {r.submittedAt && (
              <span className="ml-auto text-xs text-muted-foreground">
                {formatTimeAgo(r.submittedAt)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {automatedReviews.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Automated</p>
          <ul className="space-y-1.5">
            {automatedReviews.map((r) => (
              <li key={r.reviewer.login} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDot className="size-3 shrink-0" />
                {r.reviewer.login}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Request reviewer inline form */}
      {showRequestForm && (
        <div className="mt-3 border-t pt-3 space-y-2">
          <p className="text-xs font-medium">Request a reviewer</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="GitHub username"
              value={requestLogin}
              onChange={(e) => setRequestLogin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRequestReviewer()}
              className="flex-1 rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
            />
            <Button
              size="sm"
              onClick={handleRequestReviewer}
              disabled={requestSubmitting || !requestLogin.trim()}
            >
              {requestSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      )}

      {/* Add review inline form */}
      {showReviewForm && (
        <div className="mt-3 border-t pt-3 space-y-3">
          {/* Event selector */}
          <div className="flex gap-1">
            {EVENT_BUTTONS.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setReviewEvent(btn.value)}
                className={[
                  "flex-1 rounded-md border px-2 py-1 text-xs transition-colors",
                  reviewEvent === btn.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
                ].join(" ")}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <Textarea
            placeholder={
              reviewEvent === "APPROVE"
                ? "Optional comment…"
                : reviewEvent === "REQUEST_CHANGES"
                  ? "What needs to change? (required)"
                  : "Leave a comment…"
            }
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            className="text-sm"
          />

          {formError && <p className="text-xs text-destructive">{formError}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowReviewForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitReview} disabled={submitting} className="gap-1.5">
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Submit review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
