"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import type { PendingReviewComment } from "@/lib/github/types";

interface InlineCommentFormProps {
  quotedText?: string;
  initialBody?: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function InlineCommentForm({
  quotedText,
  initialBody = "",
  onSubmit,
  onCancel,
  submitLabel = "Add comment",
}: InlineCommentFormProps) {
  const [body, setBody] = useState(initialBody);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 shadow-sm">
      {quotedText && (
        <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-xs text-muted-foreground italic line-clamp-3">
          {quotedText}
        </blockquote>
      )}
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment…"
        className="w-full resize-y rounded-md border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        style={{ minHeight: "80px" }}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { if (body.trim()) onSubmit(body.trim()); }}
          disabled={!body.trim()}
          className="rounded-md bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50 hover:opacity-80 transition-opacity"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function PendingCommentCard({
  comment,
  onUpdate,
  onRemove,
}: {
  comment: PendingReviewComment;
  onUpdate: (id: string, body: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InlineCommentForm
        initialBody={comment.body}
        quotedText={comment.quotedText}
        onSubmit={(body) => { onUpdate(comment.id, body); setEditing(false); }}
        onCancel={() => setEditing(false)}
        submitLabel="Update"
      />
    );
  }

  return (
    <div className="rounded border bg-card p-2 text-xs space-y-1">
      {comment.quotedText && (
        <blockquote className="border-l-2 pl-2 text-muted-foreground italic line-clamp-2">
          {comment.quotedText}
        </blockquote>
      )}
      <p className="text-foreground">{comment.body}</p>
      <div className="flex gap-3">
        <button
          onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onRemove(comment.id)}
          className="text-destructive hover:underline"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

interface PendingCommentRowProps {
  comments: PendingReviewComment[];
  onUpdate: (id: string, body: string) => void;
  onRemove: (id: string) => void;
}

export function PendingCommentRow({ comments, onUpdate, onRemove }: PendingCommentRowProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b bg-blue-50/50 dark:bg-blue-950/20 px-3 py-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:underline"
      >
        <MessageSquare className="size-3" />
        {comments.length} pending comment{comments.length > 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => (
            <PendingCommentCard key={c.id} comment={c} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
