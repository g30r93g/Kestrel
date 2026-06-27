# PR Review Mode + Collaborator Reviewer Selector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app PR review workflow — inline line/text comments, per-file "reviewed" checkboxes, a sticky submit bar — plus a searchable collaborator-only multi-select for requesting reviewers.

**Architecture:** Review state lives in a `ReviewDraftContext` backed by `localStorage`, keyed by `review-draft:{owner}/{repo}/{prNumber}`. The diff view at `/[owner]/[repo]/pulls/[prNumber]/diff` detects `?review=true` and enters review mode; a `ReviewBar` fixed to the bottom submits the batch via the GitHub API. The collaborator selector replaces the plain-text reviewer input in `zone-reviews.tsx`.

**Tech Stack:** Next.js (App Router), React 19, TypeScript 5, Tailwind 4, Base UI (`@base-ui/react`), SWR 2, Octokit 5, `lucide-react`, `motion/react` v12.

> **No automated test suite.** Verification steps use `pnpm --filter web exec tsc --noEmit` (type-check) plus manual browser testing. Every task ends with a type-check step before commit.

## Global Constraints

- All client components: `"use client"` at the top.
- All server data functions: `"use server"` at the top; `getOctokit()` called outside try/catch (throws on auth failure).
- SWR key tuples: `[owner, repo, prNumber, "reviews"|"patches"|...]`.
- `useParams<{ owner: string; rest?: string[] }>()` — `rest[0]`=repo, `rest[2]`=prNumber.
- Action button class: `"flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"`.
- `localStorage` key format: `review-draft:{owner}/{repo}/{prNumber}`.
- Draft stale check: discard draft when `draft.commitSha !== pr.headSha`.
- GitHub API: `pulls.createReview` for batch line comments, `octokit.request("POST /repos/…/pulls/…/comments")` for file-level comments.
- `LEFT` side = removed lines (old file); `RIGHT` side = added lines (new file); `UnifiedDiff` uses `RIGHT` for add lines and `LEFT` for remove lines.
- No comments, no docstrings, no `TODO` placeholders.

---

## File Map

**New files:**
- `apps/web/src/components/pulls/review-draft-context.tsx` — context + localStorage persistence
- `apps/web/src/components/pulls/inline-comment-form.tsx` — reusable textarea card + pending comment display
- `apps/web/src/components/pulls/review-bar.tsx` — sticky bottom submission bar
- `apps/web/src/components/pulls/collaborator-selector.tsx` — Base UI Popover multi-select combobox

**Modified files:**
- `apps/web/src/lib/github/types.ts` — add `PRCollaborator`, `PendingReviewComment`, `ReviewDraft`
- `apps/web/src/lib/github/pulls.ts` — add `fetchCollaborators`
- `apps/web/src/lib/github/pulls-actions.ts` — extend `submitReview`, add `createFileComment`
- `apps/web/src/components/pulls/diff-view.tsx` — review mode, data-attrs, selection state, file controls, `ReviewDraftProvider` wrap
- `apps/web/src/components/pulls/zone-reviews.tsx` — replace inline review form with nav link, replace text input with `CollaboratorSelector`

---

### Task 1: Types

**Files:**
- Modify: `apps/web/src/lib/github/types.ts`

**Interfaces:**
- Produces: `PRCollaborator`, `PendingReviewComment`, `ReviewDraft` — imported by all subsequent tasks.

- [ ] **Step 1: Add the three interfaces to the end of `types.ts`**

Open `apps/web/src/lib/github/types.ts`. Append after the last existing export:

```typescript
export interface PRCollaborator {
  login: string;
  avatarUrl: string;
}

export interface PendingReviewComment {
  id: string;
  path: string;
  body: string;
  line: number;
  startLine?: number;
  side: "LEFT" | "RIGHT";
  startSide?: "LEFT" | "RIGHT";
  isFileLevel?: boolean;
  quotedText?: string;
}

export interface ReviewDraft {
  commitSha: string;
  comments: PendingReviewComment[];
  markedFiles: string[];
  body: string;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/github/types.ts
git commit -m "feat: add PRCollaborator, PendingReviewComment, ReviewDraft types"
```

---

### Task 2: Data Layer

**Files:**
- Modify: `apps/web/src/lib/github/pulls.ts` (add `fetchCollaborators`)
- Modify: `apps/web/src/lib/github/pulls-actions.ts` (extend `submitReview`, add `createFileComment`)

**Interfaces:**
- Consumes: `PRCollaborator` from Task 1.
- Produces:
  - `fetchCollaborators(owner, repo): Promise<PRCollaborator[]>`
  - `submitReview(owner, repo, pullNumber, body, event, commitId?, comments?): Promise<{success, error?}>`
  - `createFileComment(owner, repo, pullNumber, commitId, path, body): Promise<{success, error?}>`

- [ ] **Step 1: Add `fetchCollaborators` to `pulls.ts`**

Append after the last function in `apps/web/src/lib/github/pulls.ts`. Add the import for `PRCollaborator` to the existing import block at the top first:

In the import at the top of `pulls.ts`, add `PRCollaborator` to the destructured type list.

Then append to the end of the file:

```typescript
export async function fetchCollaborators(
  owner: string,
  repo: string,
): Promise<PRCollaborator[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.repos.listCollaborators({
      owner,
      repo,
      per_page: 100,
    });
    return data.map((u) => ({ login: u.login, avatarUrl: u.avatar_url }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Extend `submitReview` in `pulls-actions.ts`**

Replace the existing `submitReview` function (lines 5–25) with the extended version that accepts optional `commitId` and `comments`:

```typescript
export async function submitReview(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  commitId?: string,
  comments?: Array<{
    path: string;
    line: number;
    start_line?: number;
    side?: "LEFT" | "RIGHT";
    start_side?: "LEFT" | "RIGHT";
    body: string;
  }>,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      event,
      ...(commitId ? { commit_id: commitId } : {}),
      ...(comments?.length ? { comments } : {}),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Review failed" };
  }
}
```

- [ ] **Step 3: Add `createFileComment` to `pulls-actions.ts`**

Append after the `submitReview` function:

```typescript
export async function createFileComment(
  owner: string,
  repo: string,
  pullNumber: number,
  commitId: string,
  path: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const octokit = await getOctokit();
  try {
    await octokit.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/comments", {
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitId,
      path,
      body,
      subject_type: "file",
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Comment failed" };
  }
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/github/pulls.ts apps/web/src/lib/github/pulls-actions.ts
git commit -m "feat: add fetchCollaborators, extend submitReview with line comments, add createFileComment"
```

---

### Task 3: ReviewDraftContext

**Files:**
- Create: `apps/web/src/components/pulls/review-draft-context.tsx`

**Interfaces:**
- Consumes: `PendingReviewComment`, `ReviewDraft` from Task 1.
- Produces:
  - `ReviewDraftProvider({ owner, repo, prNumber, commitSha, enabled, children })`
  - `useReviewDraft(): ReviewDraftContextValue`
  - `ReviewDraftContextValue` interface (inline, not exported)

- [ ] **Step 1: Create the context file**

Create `apps/web/src/components/pulls/review-draft-context.tsx`:

```typescript
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PendingReviewComment, ReviewDraft } from "@/lib/github/types";

interface ReviewDraftContextValue {
  draft: ReviewDraft;
  addComment: (comment: Omit<PendingReviewComment, "id">) => void;
  updateComment: (id: string, body: string) => void;
  removeComment: (id: string) => void;
  toggleFile: (filename: string) => void;
  setBody: (body: string) => void;
  clearDraft: () => void;
}

const ReviewDraftContext = createContext<ReviewDraftContextValue | null>(null);

const EMPTY: ReviewDraft = { commitSha: "", comments: [], markedFiles: [], body: "" };

function storageKey(owner: string, repo: string, prNumber: number) {
  return `review-draft:${owner}/${repo}/${prNumber}`;
}

function readDraft(key: string, commitSha: string): ReviewDraft {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...EMPTY, commitSha };
    const parsed = JSON.parse(raw) as ReviewDraft;
    if (parsed.commitSha !== commitSha) return { ...EMPTY, commitSha };
    return parsed;
  } catch {
    return { ...EMPTY, commitSha };
  }
}

function writeDraft(key: string, draft: ReviewDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // SSR or private-mode quota exceeded
  }
}

interface ReviewDraftProviderProps {
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
  enabled: boolean;
  children: React.ReactNode;
}

export function ReviewDraftProvider({
  owner,
  repo,
  prNumber,
  commitSha,
  enabled,
  children,
}: ReviewDraftProviderProps) {
  const key = storageKey(owner, repo, prNumber);

  const [draft, setDraft] = useState<ReviewDraft>(() =>
    typeof window !== "undefined" && commitSha
      ? readDraft(key, commitSha)
      : { ...EMPTY, commitSha },
  );

  const prevCommitSha = useRef(commitSha);
  useEffect(() => {
    if (commitSha && commitSha !== prevCommitSha.current) {
      prevCommitSha.current = commitSha;
      setDraft(readDraft(key, commitSha));
    }
  }, [commitSha, key]);

  const update = useCallback(
    (updater: (prev: ReviewDraft) => ReviewDraft) => {
      setDraft((prev) => {
        const next = updater(prev);
        writeDraft(key, next);
        return next;
      });
    },
    [key],
  );

  const addComment = useCallback(
    (comment: Omit<PendingReviewComment, "id">) => {
      update((prev) => ({
        ...prev,
        comments: [...prev.comments, { ...comment, id: crypto.randomUUID() }],
      }));
    },
    [update],
  );

  const updateComment = useCallback(
    (id: string, body: string) => {
      update((prev) => ({
        ...prev,
        comments: prev.comments.map((c) => (c.id === id ? { ...c, body } : c)),
      }));
    },
    [update],
  );

  const removeComment = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        comments: prev.comments.filter((c) => c.id !== id),
      }));
    },
    [update],
  );

  const toggleFile = useCallback(
    (filename: string) => {
      update((prev) => ({
        ...prev,
        markedFiles: prev.markedFiles.includes(filename)
          ? prev.markedFiles.filter((f) => f !== filename)
          : [...prev.markedFiles, filename],
      }));
    },
    [update],
  );

  const setBody = useCallback(
    (body: string) => update((prev) => ({ ...prev, body })),
    [update],
  );

  const clearDraft = useCallback(() => {
    const fresh = { ...EMPTY, commitSha };
    writeDraft(key, fresh);
    setDraft(fresh);
  }, [key, commitSha]);

  const value = useMemo<ReviewDraftContextValue>(
    () => ({ draft, addComment, updateComment, removeComment, toggleFile, setBody, clearDraft }),
    [draft, addComment, updateComment, removeComment, toggleFile, setBody, clearDraft],
  );

  if (!enabled) return <>{children}</>;
  return <ReviewDraftContext.Provider value={value}>{children}</ReviewDraftContext.Provider>;
}

export function useReviewDraft(): ReviewDraftContextValue {
  const ctx = useContext(ReviewDraftContext);
  if (!ctx) throw new Error("useReviewDraft must be used within ReviewDraftProvider");
  return ctx;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/pulls/review-draft-context.tsx
git commit -m "feat: ReviewDraftContext with localStorage persistence"
```

---

### Task 4: InlineCommentForm + PendingCommentRow

**Files:**
- Create: `apps/web/src/components/pulls/inline-comment-form.tsx`

**Interfaces:**
- Produces:
  - `InlineCommentForm({ quotedText?, initialBody?, onSubmit, onCancel, submitLabel? })`
  - `PendingCommentRow({ comments, onUpdate, onRemove })` — collapsible list of pending comments with edit/remove
- Consumes: `PendingReviewComment` from Task 1.

- [ ] **Step 1: Create the file**

Create `apps/web/src/components/pulls/inline-comment-form.tsx`:

```typescript
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
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/pulls/inline-comment-form.tsx
git commit -m "feat: InlineCommentForm and PendingCommentRow components"
```

---

### Task 5: Diff View — Review Mode Foundation

**Files:**
- Modify: `apps/web/src/components/pulls/diff-view.tsx`

**Interfaces:**
- Consumes: `ReviewDraftProvider`, `useReviewDraft` (Task 3); `fetchPullRequest` (already exists in `pulls.ts`); `ReviewDraft`, `PendingReviewComment` (Task 1).
- Produces: `DiffView` now accepts review mode via `?review=true` URL param; wraps content in `ReviewDraftProvider`.

This task only adds the foundation — no gutter interaction yet. The diff renders identically in and out of review mode after this task; the `ReviewDraftProvider` is wired but no review UI is visible yet.

- [ ] **Step 1: Update imports in `diff-view.tsx`**

Replace the existing imports block at the top of `apps/web/src/components/pulls/diff-view.tsx`:

```typescript
"use client";

import { fetchPullRequest, fetchPullRequestPatches, type PatchFile } from "@/lib/github/pulls";
import { ReviewDraftProvider, useReviewDraft } from "@/components/pulls/review-draft-context";
import type { PendingReviewComment } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronToggle } from "@/components/ui/chevron-toggle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
```

- [ ] **Step 2: Add `FileReviewProps` interface after the existing local type block (after `DiffNode`)**

In `diff-view.tsx`, after the `interface DiffNode` block (around line 39), add:

```typescript
interface FileReviewProps {
  openComment: {
    line: number;
    startLine?: number;
    side: "LEFT" | "RIGHT";
    startSide?: "LEFT" | "RIGHT";
    quotedText?: string;
  } | null;
  lineSelection: {
    anchorLine: number;
    activeLine: number;
    side: "LEFT" | "RIGHT";
  } | null;
  pendingComments: PendingReviewComment[];
  onLineClick: (line: number, side: "LEFT" | "RIGHT", shiftKey: boolean) => void;
  onCloseComment: () => void;
  onAddComment: (body: string) => void;
  onUpdateComment: (id: string, body: string) => void;
  onRemoveComment: (id: string) => void;
}
```

- [ ] **Step 3: Update `DiffView` to detect review mode and fetch the PR**

Replace the `DiffView` function body (keep the signature `({ owner, repo, prNumber }: DiffViewProps)`):

```typescript
export function DiffView({ owner, repo, prNumber }: DiffViewProps) {
  const [mode, setMode] = useState<DiffMode>("unified");
  const searchParams = useSearchParams();
  const reviewMode = searchParams.get("review") === "true";

  const { data: files = [], isLoading } = useSWR(
    [owner, repo, prNumber, "patches"],
    ([o, r, n]) => fetchPullRequestPatches(o, r, n),
  );

  const { data: pr } = useSWR(
    reviewMode ? [owner, repo, prNumber, "pr"] : null,
    ([o, r, n]) => fetchPullRequest(o, r, n),
  );

  const commitSha = pr?.headSha ?? "";

  return (
    <ReviewDraftProvider
      owner={owner}
      repo={repo}
      prNumber={prNumber}
      commitSha={commitSha}
      enabled={reviewMode}
    >
      <DiffViewInner
        owner={owner}
        repo={repo}
        prNumber={prNumber}
        mode={mode}
        setMode={setMode}
        files={files}
        isLoading={isLoading}
        reviewMode={reviewMode}
        commitSha={commitSha}
      />
    </ReviewDraftProvider>
  );
}
```

- [ ] **Step 4: Extract `DiffViewInner`**

Add `DiffViewInner` as a new function after `DiffView` (or before it — place it before `DiffView` since `DiffView` references it). This component has access to `ReviewDraftContext` because it renders inside `ReviewDraftProvider`.

```typescript
interface DiffViewInnerProps {
  owner: string;
  repo: string;
  prNumber: number;
  mode: DiffMode;
  setMode: (m: DiffMode) => void;
  files: PatchFile[];
  isLoading: boolean;
  reviewMode: boolean;
  commitSha: string;
}

function DiffViewInner({
  owner,
  repo,
  prNumber,
  mode,
  setMode,
  files,
  isLoading,
  reviewMode,
  commitSha,
}: DiffViewInnerProps) {
  const { draft, addComment, updateComment, removeComment } = reviewMode
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useReviewDraft()
    : {
        draft: { commitSha: "", comments: [], markedFiles: [], body: "" },
        addComment: () => {},
        updateComment: () => {},
        removeComment: () => {},
      };

  const [openComment, setOpenComment] = useState<{
    path: string;
    line: number;
    startLine?: number;
    side: "LEFT" | "RIGHT";
    startSide?: "LEFT" | "RIGHT";
    quotedText?: string;
  } | null>(null);

  const [lineSelection, setLineSelection] = useState<{
    path: string;
    anchorLine: number;
    activeLine: number;
    side: "LEFT" | "RIGHT";
  } | null>(null);

  const handleLineClick = useCallback(
    (path: string, line: number, side: "LEFT" | "RIGHT", shiftKey: boolean) => {
      if (
        shiftKey &&
        lineSelection &&
        lineSelection.path === path &&
        lineSelection.side === side
      ) {
        const next = { ...lineSelection, activeLine: line };
        setLineSelection(next);
        const minLine = Math.min(next.anchorLine, next.activeLine);
        const maxLine = Math.max(next.anchorLine, next.activeLine);
        setOpenComment({
          path,
          line: maxLine,
          startLine: minLine < maxLine ? minLine : undefined,
          side,
          startSide: minLine < maxLine ? side : undefined,
        });
      } else {
        setLineSelection({ path, anchorLine: line, activeLine: line, side });
        setOpenComment({ path, line, side });
      }
    },
    [lineSelection],
  );

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* File tree sidebar */}
      <aside className="hidden w-52 shrink-0 overflow-y-auto border-r md:block">
        {isLoading ? (
          <div className="space-y-1.5 p-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-4" />)}
          </div>
        ) : (
          <DiffFileTree files={files} />
        )}
      </aside>

      {/* Main diff area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <Link
            href={`/${owner}/${repo}/pulls/${prNumber}`}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to PR #{prNumber}
          </Link>
          <Tabs value={mode} onValueChange={(v) => setMode(v as DiffMode)}>
            <TabsList>
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* File patches */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 [scrollbar-gutter:stable]">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border bg-card p-4">
                  <Skeleton className="mb-2 h-4 w-64" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && files.length === 0 && (
            <p className="text-sm text-muted-foreground">No file changes in this PR.</p>
          )}
          {!isLoading &&
            files.map((f) => (
              <FilePatch
                key={f.filename}
                file={f}
                mode={mode}
                reviewMode={reviewMode}
                fileReviewProps={
                  reviewMode
                    ? {
                        openComment:
                          openComment?.path === f.filename
                            ? {
                                line: openComment.line,
                                startLine: openComment.startLine,
                                side: openComment.side,
                                startSide: openComment.startSide,
                                quotedText: openComment.quotedText,
                              }
                            : null,
                        lineSelection:
                          lineSelection?.path === f.filename
                            ? {
                                anchorLine: lineSelection.anchorLine,
                                activeLine: lineSelection.activeLine,
                                side: lineSelection.side,
                              }
                            : null,
                        pendingComments: draft.comments.filter(
                          (c) => c.path === f.filename,
                        ),
                        onLineClick: (line, side, shiftKey) =>
                          handleLineClick(f.filename, line, side, shiftKey),
                        onCloseComment: () => {
                          setOpenComment(null);
                          setLineSelection(null);
                        },
                        onAddComment: (body) => {
                          if (!openComment) return;
                          addComment({
                            path: openComment.path,
                            body,
                            line: openComment.line,
                            startLine: openComment.startLine,
                            side: openComment.side,
                            startSide: openComment.startSide,
                            quotedText: openComment.quotedText,
                          });
                          setOpenComment(null);
                          setLineSelection(null);
                        },
                        onUpdateComment: updateComment,
                        onRemoveComment: removeComment,
                      }
                    : undefined
                }
              />
            ))}
        </div>
      </div>
    </div>
  );
}
```

> **Note on conditional hook:** The `useReviewDraft()` call uses a conditional wrapper. ESLint may flag this. Add `// eslint-disable-next-line react-hooks/rules-of-hooks` above the call, or restructure so `DiffViewInner` always calls `useReviewDraft()` and `ReviewDraftProvider` provides a no-op context when `enabled=false`. The simplest fix: move the conditional context call into a helper inner component or always call the hook and guard at the action level.
>
> **Recommended alternative:** Instead of the conditional `useReviewDraft()` call, wrap `DiffViewInner` in a thin `DiffViewInnerWithDraft` child that always calls `useReviewDraft()` and is only rendered inside an `enabled=true` `ReviewDraftProvider`. Then `DiffViewInner` takes the draft actions as props. This avoids the conditional hook entirely. This is the approach to use if the ESLint rule is enforced.

- [ ] **Step 5: Update `FilePatch` signature**

The `FilePatch` function currently has `{ file, mode }`. Update it to:

```typescript
function FilePatch({
  file,
  mode,
  reviewMode = false,
  fileReviewProps,
}: {
  file: PatchFile;
  mode: DiffMode;
  reviewMode?: boolean;
  fileReviewProps?: FileReviewProps;
}) {
```

Keep the body of `FilePatch` identical for now (review controls added in Task 8). Pass `fileReviewProps` through to `UnifiedDiff` and `SplitDiff`:

```typescript
mode === "unified" ? (
  <UnifiedDiff lines={lines} reviewProps={fileReviewProps} />
) : (
  <SplitDiff rows={splitRows} reviewProps={fileReviewProps} />
)
```

- [ ] **Step 6: Update `UnifiedDiff` and `SplitDiff` to accept `reviewProps`**

Add the optional prop (body unchanged — review rendering added in Task 6):

```typescript
function UnifiedDiff({ lines, reviewProps }: { lines: ParsedLine[]; reviewProps?: FileReviewProps }) {
```

```typescript
function SplitDiff({ rows, reviewProps }: { rows: SplitRow[]; reviewProps?: FileReviewProps }) {
```

No other changes to these functions yet.

- [ ] **Step 7: Remove unused `DiffView` export and keep only the new one**

Delete the old `DiffView` function that was replaced in Step 3. The file now exports only one `DiffView` function.

- [ ] **Step 8: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Manual smoke test**

Run `pnpm --filter web dev`, open a PR diff page (without `?review=true`) and confirm it still works. Then add `?review=true` and confirm the page loads without crashing.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/pulls/diff-view.tsx
git commit -m "feat: diff view review mode foundation — ReviewDraftProvider, PR SWR, openComment/lineSelection state"
```

---

### Task 6: Gutter Click + Inline Forms in UnifiedDiff / SplitDiff

**Files:**
- Modify: `apps/web/src/components/pulls/diff-view.tsx`

**Interfaces:**
- Consumes: `FileReviewProps` (Task 5); `InlineCommentForm`, `PendingCommentRow` (Task 4).
- Produces: `UnifiedDiff` and `SplitDiff` with clickable gutters, selection highlights, inline comment forms, and pending comment indicators.

- [ ] **Step 1: Import `InlineCommentForm` and `PendingCommentRow` in `diff-view.tsx`**

Add to imports:

```typescript
import { InlineCommentForm, PendingCommentRow } from "@/components/pulls/inline-comment-form";
```

- [ ] **Step 2: Rewrite `UnifiedDiff`**

Replace the entire `UnifiedDiff` function:

```typescript
function UnifiedDiff({ lines, reviewProps }: { lines: ParsedLine[]; reviewProps?: FileReviewProps }) {
  const elems: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.type === "hunkHeader") {
      elems.push(
        <div key={`h${i}`} className="flex bg-muted">
          <span className={NUM} />
          <span className={NUM} />
          <span className="flex-1 whitespace-pre px-3 py-0.5 font-mono text-xs text-muted-foreground">
            {line.content}
          </span>
        </div>,
      );
      continue;
    }

    const leftNum = line.type !== "add" ? line.oldLine : undefined;
    const rightNum = line.type !== "remove" ? line.newLine : undefined;

    const sel = reviewProps?.lineSelection;
    const selMin = sel ? Math.min(sel.anchorLine, sel.activeLine) : 0;
    const selMax = sel ? Math.max(sel.anchorLine, sel.activeLine) : 0;
    const leftSel =
      !!reviewProps && sel?.side === "LEFT" && leftNum !== undefined && leftNum >= selMin && leftNum <= selMax;
    const rightSel =
      !!reviewProps && sel?.side === "RIGHT" && rightNum !== undefined && rightNum >= selMin && rightNum <= selMax;

    const makeGutter = (num: number | undefined, side: "LEFT" | "RIGHT", extra?: string) => (
      <span
        className={cn(
          NUM,
          extra,
          reviewProps && num !== undefined && "cursor-pointer hover:bg-blue-100/60 dark:hover:bg-blue-900/20",
          (side === "LEFT" ? leftSel : rightSel) && "bg-blue-200/70 dark:bg-blue-800/50",
        )}
        data-line={num}
        data-side={side}
        onClick={
          reviewProps && num !== undefined
            ? (e) => reviewProps.onLineClick(num, side, e.shiftKey)
            : undefined
        }
      >
        {num}
      </span>
    );

    const rowBg =
      line.type === "add"
        ? "bg-green-50 dark:bg-green-950/40"
        : line.type === "remove"
          ? "bg-red-50 dark:bg-red-950/40"
          : "";
    const textColor =
      line.type === "add"
        ? "text-green-800 dark:text-green-300"
        : line.type === "remove"
          ? "text-red-800 dark:text-red-300"
          : "text-foreground";
    const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

    elems.push(
      <div
        key={`l${i}`}
        className={cn("flex", rowBg, (leftSel || rightSel) && "ring-1 ring-inset ring-blue-300/60 dark:ring-blue-600/40")}
      >
        {makeGutter(leftNum, "LEFT", line.type === "remove" ? "bg-red-100/60 dark:bg-red-900/40" : undefined)}
        {makeGutter(rightNum, "RIGHT", line.type === "add" ? "bg-green-100/60 dark:bg-green-900/40" : undefined)}
        <span className={cn("flex-1 whitespace-pre px-3 py-0 font-mono text-xs", textColor)}>
          {prefix}{line.content}
        </span>
      </div>,
    );

    if (reviewProps) {
      const oc = reviewProps.openComment;
      const showForm =
        oc &&
        ((oc.side === "RIGHT" && rightNum === oc.line) ||
          (oc.side === "LEFT" && leftNum === oc.line));

      if (showForm) {
        elems.push(
          <div key={`f${i}`} className="border-b bg-blue-50/30 dark:bg-blue-950/10 px-3 py-2">
            <InlineCommentForm
              quotedText={oc?.quotedText}
              onSubmit={reviewProps.onAddComment}
              onCancel={reviewProps.onCloseComment}
            />
          </div>,
        );
      }

      const pending = reviewProps.pendingComments.filter(
        (c) =>
          !c.isFileLevel &&
          ((c.side === "RIGHT" && rightNum === c.line) ||
            (c.side === "LEFT" && leftNum === c.line)),
      );
      if (pending.length > 0) {
        elems.push(
          <PendingCommentRow
            key={`p${i}`}
            comments={pending}
            onUpdate={reviewProps.onUpdateComment}
            onRemove={reviewProps.onRemoveComment}
          />,
        );
      }
    }
  }

  return <div className="w-max min-w-full">{elems}</div>;
}
```

- [ ] **Step 3: Rewrite `SplitDiff`**

Replace the entire `SplitDiff` function:

```typescript
function SplitDiff({ rows, reviewProps }: { rows: SplitRow[]; reviewProps?: FileReviewProps }) {
  const elems: React.ReactNode[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.type === "hunkHeader") {
      elems.push(
        <div key={`h${i}`} className="flex bg-muted">
          <span className="flex-1 whitespace-pre px-3 py-0.5 font-mono text-xs text-muted-foreground">
            {row.header}
          </span>
        </div>,
      );
      continue;
    }

    const sel = reviewProps?.lineSelection;
    const selMin = sel ? Math.min(sel.anchorLine, sel.activeLine) : 0;
    const selMax = sel ? Math.max(sel.anchorLine, sel.activeLine) : 0;
    const leftSel =
      !!reviewProps && sel?.side === "LEFT" && row.oldLine !== undefined && row.oldLine >= selMin && row.oldLine <= selMax;
    const rightSel =
      !!reviewProps && sel?.side === "RIGHT" && row.newLine !== undefined && row.newLine >= selMin && row.newLine <= selMax;

    const isOldChange = row.type === "change" && row.oldContent !== undefined;
    const isNewChange = row.type === "change" && row.newContent !== undefined;

    const makeGutter = (num: number | undefined, side: "LEFT" | "RIGHT", isChange: boolean) => (
      <span
        className={cn(
          NUM,
          isChange && (side === "LEFT" ? "bg-red-100/60 dark:bg-red-900/40" : "bg-green-100/60 dark:bg-green-900/40"),
          reviewProps && num !== undefined && "cursor-pointer hover:bg-blue-100/60 dark:hover:bg-blue-900/20",
          (side === "LEFT" ? leftSel : rightSel) && "bg-blue-200/70 dark:bg-blue-800/50",
        )}
        data-line={num}
        data-side={side}
        onClick={
          reviewProps && num !== undefined
            ? (e) => reviewProps.onLineClick(num, side, e.shiftKey)
            : undefined
        }
      >
        {num ?? ""}
      </span>
    );

    elems.push(
      <div key={`l${i}`} className="flex min-w-0">
        <div
          className={cn(
            "flex min-w-0 flex-1 overflow-x-auto",
            isOldChange && "bg-red-50 dark:bg-red-950/40",
            leftSel && "ring-1 ring-inset ring-blue-300/60 dark:ring-blue-600/40",
          )}
        >
          {makeGutter(row.oldLine, "LEFT", isOldChange)}
          <span
            className={cn(
              "flex-1 whitespace-pre px-3 py-0 font-mono text-xs",
              isOldChange ? "text-red-800 dark:text-red-300" : "text-foreground",
            )}
          >
            {row.oldContent ?? ""}
          </span>
        </div>
        <div className="w-px shrink-0 bg-border" />
        <div
          className={cn(
            "flex min-w-0 flex-1 overflow-x-auto",
            isNewChange && "bg-green-50 dark:bg-green-950/40",
            rightSel && "ring-1 ring-inset ring-blue-300/60 dark:ring-blue-600/40",
          )}
        >
          {makeGutter(row.newLine, "RIGHT", isNewChange)}
          <span
            className={cn(
              "flex-1 whitespace-pre px-3 py-0 font-mono text-xs",
              isNewChange ? "text-green-800 dark:text-green-300" : "text-foreground",
            )}
          >
            {row.newContent ?? ""}
          </span>
        </div>
      </div>,
    );

    if (reviewProps) {
      const oc = reviewProps.openComment;
      const showForm =
        oc &&
        ((oc.side === "RIGHT" && row.newLine === oc.line) ||
          (oc.side === "LEFT" && row.oldLine === oc.line));

      if (showForm) {
        elems.push(
          <div key={`f${i}`} className="border-b bg-blue-50/30 dark:bg-blue-950/10 px-3 py-2">
            <InlineCommentForm
              quotedText={oc?.quotedText}
              onSubmit={reviewProps.onAddComment}
              onCancel={reviewProps.onCloseComment}
            />
          </div>,
        );
      }

      const pending = reviewProps.pendingComments.filter(
        (c) =>
          !c.isFileLevel &&
          ((c.side === "RIGHT" && row.newLine === c.line) ||
            (c.side === "LEFT" && row.oldLine === c.line)),
      );
      if (pending.length > 0) {
        elems.push(
          <PendingCommentRow
            key={`p${i}`}
            comments={pending}
            onUpdate={reviewProps.onUpdateComment}
            onRemove={reviewProps.onRemoveComment}
          />,
        );
      }
    }
  }

  return <div className="min-w-full">{elems}</div>;
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

1. Open a PR diff with `?review=true`.
2. Click a line number — the inline comment form should appear below that row.
3. Type a comment and click "Add comment" — the form closes and a "1 pending comment" indicator appears.
4. Shift-click a different line — the selection should highlight the range; the form appears at the last line.
5. Without `?review=true`, confirm line numbers are not clickable.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/pulls/diff-view.tsx
git commit -m "feat: gutter click selection and inline comment forms in UnifiedDiff/SplitDiff"
```

---

### Task 7: Text Selection Tooltip

**Files:**
- Modify: `apps/web/src/components/pulls/diff-view.tsx`

**Interfaces:**
- Produces: floating "Comment" button that appears after the user selects text in the diff area when `reviewMode` is active.

The tooltip reads `data-line`, `data-path`, `data-side` attributes from the DOM nodes covering the selection ends to resolve which lines are spanned.

- [ ] **Step 1: Add tooltip imports**

Add to imports in `diff-view.tsx`:

```typescript
import { MessageSquarePlus } from "lucide-react";
import { useEffect, useRef } from "react";
```

(`useRef` and `useEffect` will be needed alongside existing `useCallback` and `useState`.)

- [ ] **Step 2: Add `textTooltip` state to `DiffViewInner`**

Inside `DiffViewInner`, after the `lineSelection` state:

```typescript
const [textTooltip, setTextTooltip] = useState<{
  path: string;
  line: number;
  startLine?: number;
  side: "LEFT" | "RIGHT";
  startSide?: "LEFT" | "RIGHT";
  quotedText: string;
  x: number;
  y: number;
} | null>(null);

const scrollContainerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Add `mouseup` listener on the scroll container**

After the `handleLineClick` callback in `DiffViewInner`:

```typescript
useEffect(() => {
  if (!reviewMode) return;

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setTextTooltip(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const startNode = range.startContainer.parentElement;
    const endNode = range.endContainer.parentElement;

    const findLineData = (el: Element | null) => {
      while (el) {
        const line = el.getAttribute("data-line");
        const path = el.getAttribute("data-path");
        const side = el.getAttribute("data-side") as "LEFT" | "RIGHT" | null;
        if (line && path && side) return { line: parseInt(line, 10), path, side };
        const row = el.closest("[data-line]");
        if (row) {
          const rowLine = row.getAttribute("data-line");
          const rowPath = row.getAttribute("data-path");
          const rowSide = row.getAttribute("data-side") as "LEFT" | "RIGHT" | null;
          if (rowLine && rowPath && rowSide)
            return { line: parseInt(rowLine, 10), path: rowPath, side: rowSide };
        }
        el = el.parentElement;
      }
      return null;
    };

    const startData = findLineData(startNode);
    const endData = findLineData(endNode);

    if (!startData || !endData || startData.path !== endData.path) {
      setTextTooltip(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setTextTooltip({
      path: endData.path,
      line: endData.line,
      startLine: startData.line !== endData.line ? startData.line : undefined,
      side: endData.side,
      startSide: startData.side !== endData.side ? startData.side : undefined,
      quotedText: sel.toString().trim().slice(0, 500),
      x: rect.left + rect.width / 2 - 40,
      y: rect.bottom + 6,
    });
  };

  document.addEventListener("mouseup", handleMouseUp);
  return () => document.removeEventListener("mouseup", handleMouseUp);
}, [reviewMode]);
```

- [ ] **Step 4: Render the tooltip and attach the scroll container ref**

In the `DiffViewInner` return JSX, attach `ref={scrollContainerRef}` to the outer `<div className="flex min-w-0 flex-1 overflow-hidden">`. Then add the tooltip **at the bottom of the fragment**, after the scroll container close tag:

```tsx
{reviewMode && textTooltip && (
  <button
    style={{ position: "fixed", left: textTooltip.x, top: textTooltip.y, zIndex: 50 }}
    className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-xs text-background shadow-lg hover:opacity-80 transition-opacity"
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => {
      const tt = textTooltip;
      setTextTooltip(null);
      setLineSelection({
        path: tt.path,
        anchorLine: tt.startLine ?? tt.line,
        activeLine: tt.line,
        side: tt.side,
      });
      setOpenComment({
        path: tt.path,
        line: tt.line,
        startLine: tt.startLine,
        side: tt.side,
        startSide: tt.startSide,
        quotedText: tt.quotedText,
      });
      window.getSelection()?.removeAllRanges();
    }}
  >
    <MessageSquarePlus className="size-3" />
    Comment
  </button>
)}
```

The `onMouseDown={(e) => e.preventDefault()}` prevents the click from collapsing the selection before the handler runs.

- [ ] **Step 5: Close tooltip when openComment changes**

Add `useEffect` to dismiss the tooltip when a comment form opens through another method:

```typescript
useEffect(() => {
  if (openComment) setTextTooltip(null);
}, [openComment]);
```

- [ ] **Step 6: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual test**

1. Open a PR diff with `?review=true`.
2. Click-drag to select text across diff lines.
3. After releasing the mouse button, a "Comment" button should appear below the selection.
4. Click it — the tooltip dismisses, the inline comment form opens at the end line with the selected text quoted.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/pulls/diff-view.tsx
git commit -m "feat: text selection tooltip for quoted inline comments"
```

---

### Task 8: File Header Controls — Reviewed Checkbox + File Comment

**Files:**
- Modify: `apps/web/src/components/pulls/diff-view.tsx`

**Interfaces:**
- Consumes: `useReviewDraft` (Task 3); `InlineCommentForm` (Task 4); `FileReviewProps` (already present).
- Produces: In review mode, `FilePatch` header gains a "Reviewed" checkbox (toggles `draft.markedFiles`) and an "Add comment" button (opens a file-level `InlineCommentForm`).

- [ ] **Step 1: Update `FilePatch` to use `useReviewDraft` and add header controls**

`FilePatch` needs to call `useReviewDraft()` when `reviewMode` is true. Use the same pattern as `DiffViewInner` — either guard or split into an inner component. The simplest for this file: check `reviewMode` and only call the hook when it's active.

Since conditional hooks are not allowed in React, wrap the review-specific logic in a sub-component. Add a new `FilePatchReviewHeader` component:

```typescript
function FilePatchReviewHeader({
  filename,
  pendingFileLevelComments,
  onUpdateComment,
  onRemoveComment,
}: {
  filename: string;
  pendingFileLevelComments: PendingReviewComment[];
  onUpdateComment: (id: string, body: string) => void;
  onRemoveComment: (id: string) => void;
}) {
  const { draft, addComment, toggleFile } = useReviewDraft();
  const isReviewed = draft.markedFiles.includes(filename);
  const [showFileComment, setShowFileComment] = useState(false);

  return (
    <>
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none hover:text-foreground transition-colors">
        <input
          type="checkbox"
          checked={isReviewed}
          onChange={() => toggleFile(filename)}
          className="size-3.5 accent-foreground"
        />
        Reviewed
      </label>
      <button
        onClick={() => setShowFileComment((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
      >
        Add comment
      </button>
      {showFileComment && (
        <div className="absolute left-0 right-0 top-full z-10 border-t bg-card px-4 py-3 shadow-md">
          <InlineCommentForm
            onSubmit={(body) => {
              addComment({ path: filename, body, line: 1, side: "RIGHT", isFileLevel: true });
              setShowFileComment(false);
            }}
            onCancel={() => setShowFileComment(false)}
            submitLabel="Add file comment"
          />
        </div>
      )}
      {pendingFileLevelComments.length > 0 && (
        <PendingCommentRow
          comments={pendingFileLevelComments}
          onUpdate={onUpdateComment}
          onRemove={onRemoveComment}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update `FilePatch` header to include review controls**

Update the `FilePatch` function's header `<div className="flex items-center gap-3 px-4 py-3">` to conditionally render `FilePatchReviewHeader`:

```typescript
function FilePatch({
  file,
  mode,
  reviewMode = false,
  fileReviewProps,
}: {
  file: PatchFile;
  mode: DiffMode;
  reviewMode?: boolean;
  fileReviewProps?: FileReviewProps;
}) {
  const [open, setOpen] = useState(true);
  const lines = file.patch ? parsePatch(file.patch) : [];
  const splitRows = mode === "split" ? toSplitRows(lines) : [];

  const pendingFileLevelComments = fileReviewProps?.pendingComments.filter((c) => c.isFileLevel) ?? [];

  return (
    <div id={toAnchorId(file.filename)} className="relative scroll-mt-12 rounded-lg border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.filename}</span>
        <span className="shrink-0 text-xs text-green-600">+{file.additions}</span>
        <span className="shrink-0 text-xs text-red-500">−{file.deletions}</span>
        {reviewMode && fileReviewProps && (
          <FilePatchReviewHeader
            filename={file.filename}
            pendingFileLevelComments={pendingFileLevelComments}
            onUpdateComment={fileReviewProps.onUpdateComment}
            onRemoveComment={fileReviewProps.onRemoveComment}
          />
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronToggle open={open} className="size-4" />
        </button>
      </div>
      {open && (
        <div className="overflow-x-auto border-t">
          {file.patch === null ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">Binary file — no diff available.</p>
          ) : mode === "unified" ? (
            <UnifiedDiff lines={lines} reviewProps={fileReviewProps} />
          ) : (
            <SplitDiff rows={splitRows} reviewProps={fileReviewProps} />
          )}
        </div>
      )}
    </div>
  );
}
```

Note the `relative` class on the root `<div>` — required for the `absolute` positioned file comment form to work correctly.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test**

1. Open a PR diff with `?review=true`.
2. Confirm the file header now shows a "Reviewed" checkbox and "Add comment" button.
3. Check the checkbox — it should persist on page refresh (localStorage).
4. Click "Add comment" — a comment form should drop below the header. Submit it and confirm a pending file comment appears.
5. Without `?review=true`, confirm the header is unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/pulls/diff-view.tsx
git commit -m "feat: FilePatch header controls — reviewed checkbox and file-level comment in review mode"
```

---

### Task 9: ReviewBar

**Files:**
- Create: `apps/web/src/components/pulls/review-bar.tsx`
- Modify: `apps/web/src/components/pulls/diff-view.tsx` (integrate `ReviewBar`)

**Interfaces:**
- Consumes: `useReviewDraft` (Task 3); `submitReview`, `createFileComment` (Task 2).
- Produces: `ReviewBar` — sticky bottom bar visible only in review mode; submits the draft batch and navigates back on success.

- [ ] **Step 1: Create `review-bar.tsx`**

Create `apps/web/src/components/pulls/review-bar.tsx`:

```typescript
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
}

export function ReviewBar({ owner, repo, prNumber, commitSha }: ReviewBarProps) {
  const { draft, clearDraft } = useReviewDraft();
  const router = useRouter();
  const [event, setEvent] = useState<ReviewEvent>("COMMENT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const result = await submitReview(owner, repo, prNumber, draft.body, event, commitSha, apiComments);

    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? "Submission failed");
      return;
    }

    // Post file-level comments sequentially (not part of createReview batch)
    for (const fc of fileComments) {
      await createFileComment(owner, repo, prNumber, commitSha, fc.path, fc.body);
    }

    clearDraft();
    router.push(`/${owner}/${repo}/pulls/${prNumber}`);
  };

  return (
    <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/80 px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Comment count summary */}
        <span className="text-xs text-muted-foreground">
          {totalCount === 0
            ? "No pending comments"
            : `${totalCount} pending comment${totalCount > 1 ? "s" : ""}`}
        </span>

        <div className="flex-1" />

        {/* Body input (collapsed by default — expand only when non-empty or APPROVE/REQUEST_CHANGES) */}
        <input
          type="text"
          placeholder="Add overall comment…"
          value={draft.body}
          onChange={(e) => {
            // setBody is available via useReviewDraft — but ReviewBar doesn't destructure it
            // Import setBody from the hook:
            /* see note below */
          }}
          className="hidden w-56 rounded-md border bg-background px-2.5 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {/* Event selector */}
        <div className="flex rounded-lg border overflow-hidden">
          {EVENT_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              onClick={() => { setEvent(btn.value); setError(null); }}
              className={[
                "px-3 py-1.5 text-xs transition-colors border-r last:border-r-0",
                event === btn.value
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !commitSha}
          className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-xs text-background disabled:opacity-50 hover:opacity-80 transition-opacity"
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          Submit review
        </button>
      </div>

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

> **Note on the body input:** The body input above has a placeholder for `setBody`. In the full implementation destructure `setBody` from `useReviewDraft()` alongside `draft` and `clearDraft`, then wire `onChange={(e) => setBody(e.target.value)}` and remove the `className="hidden"` to make the field visible. The body field visibility: show it always (remove `hidden`), or show inline only when the event is not `"APPROVE"`. Pick one and keep it consistent.

The recommended final body field (after fixing the note):

```tsx
const { draft, clearDraft, setBody } = useReviewDraft();
// …
<input
  type="text"
  placeholder={
    event === "APPROVE" ? "Optional comment…" :
    event === "REQUEST_CHANGES" ? "What needs to change? (required)" :
    "Overall comment…"
  }
  value={draft.body}
  onChange={(e) => setBody(e.target.value)}
  className="w-56 rounded-md border bg-background px-2.5 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
/>
```

- [ ] **Step 2: Integrate `ReviewBar` into `DiffViewInner`**

In `DiffViewInner`, import `ReviewBar`:

```typescript
import { ReviewBar } from "@/components/pulls/review-bar";
```

In the `DiffViewInner` JSX, after the closing `</div>` of the file patches scroll container (and still inside the `"flex min-w-0 flex-1 flex-col overflow-hidden"` div), add:

```tsx
{reviewMode && (
  <ReviewBar
    owner={owner}
    repo={repo}
    prNumber={prNumber}
    commitSha={commitSha}
  />
)}
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test**

1. Open a PR diff with `?review=true`.
2. The sticky bar should appear at the bottom.
3. Add a line comment, select "Approve", click "Submit review".
4. On success, should navigate back to the PR page.
5. Without `?review=true`, the bar should not appear.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/pulls/review-bar.tsx apps/web/src/components/pulls/diff-view.tsx
git commit -m "feat: ReviewBar sticky submission bar with batch review submission"
```

---

### Task 10: zone-reviews — Add Review Navigation

**Files:**
- Modify: `apps/web/src/components/pulls/zone-reviews.tsx`

**Interfaces:**
- Produces: "Add review" button navigates to `/{owner}/{repo}/pulls/{prNumber}/diff?review=true` instead of showing the inline review form. The `EVENT_BUTTONS`, `showReviewForm`, `reviewBody`, `reviewEvent`, `handleSubmitReview`, and related state are removed.

- [ ] **Step 1: Rewrite `zone-reviews.tsx`**

Replace the entire file content with the cleaned-up version (keeping the reviewer request section, removing the inline review form):

```typescript
"use client";

import type { PRReview } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/time";
import {
  CheckCircle2,
  CircleDot,
  MessageSquare,
  PenLine,
  UserPlus,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { CollaboratorSelector } from "@/components/pulls/collaborator-selector";

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

  const [showRequestForm, setShowRequestForm] = useState(false);

  const invalidate = () => {
    if (!owner || !repo || !prNumber) return;
    mutate([owner, repo, prNumber, "reviews"]);
    mutate([owner, repo, prNumber, "activity"]);
  };

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

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Reviews</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRequestForm((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
          >
            <UserPlus className="size-3.5" />
            Request reviewer
          </button>
          {owner && repo && prNumber && (
            <Link
              href={`/${owner}/${repo}/pulls/${prNumber}/diff?review=true`}
              className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
            >
              <PenLine className="size-3.5" />
              Add review
            </Link>
          )}
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

      {showRequestForm && owner && repo && prNumber && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs font-medium">Request reviewers</p>
          <CollaboratorSelector
            owner={owner}
            repo={repo}
            prNumber={prNumber}
            onSuccess={() => {
              setShowRequestForm(false);
              invalidate();
            }}
          />
        </div>
      )}
    </div>
  );
}
```

> `CollaboratorSelector` doesn't exist yet — Task 11 creates it. TypeScript will complain until that task is complete. That's expected; keep the import and complete Task 11 before running the type-check for this task.

- [ ] **Step 2: Commit (stub, CollaboratorSelector not yet available)**

```bash
git add apps/web/src/components/pulls/zone-reviews.tsx
git commit -m "feat: zone-reviews — Add review navigates to diff?review=true, removes inline form"
```

---

### Task 11: CollaboratorSelector + zone-reviews Integration

**Files:**
- Create: `apps/web/src/components/pulls/collaborator-selector.tsx`
- (Completes Task 10's stub import)

**Interfaces:**
- Consumes: `fetchCollaborators` (Task 2); `requestReview` (existing in `pulls-actions.ts`); `PRCollaborator` (Task 1); Base UI `Popover`.
- Produces: `CollaboratorSelector({ owner, repo, prNumber, onSuccess })` — Base UI Popover with a searchable multi-select list of collaborators; submits via `requestReview` on confirm.

- [ ] **Step 1: Check Base UI Popover API**

Before writing any code, verify the Popover component API from `node_modules/@base-ui-components/react/popover`:

```bash
ls node_modules/@base-ui-components/react/popover 2>/dev/null || ls node_modules/@base-ui/react/popover 2>/dev/null
```

Then read the index type to confirm the import path and sub-component names (`Popover.Root`, `Popover.Trigger`, `Popover.Popup`, `Popover.Backdrop`, `Popover.Arrow`, etc.).

- [ ] **Step 2: Create `collaborator-selector.tsx`**

Adjust the import path for `Popover` based on what Step 1 reveals. The pattern follows existing Base UI usage in this codebase (check other components for the import style — look for any file importing from `@base-ui/react` or `@base-ui-components/react`).

Create `apps/web/src/components/pulls/collaborator-selector.tsx`:

```typescript
"use client";

import { useState, useMemo } from "react";
import { Popover } from "@base-ui-components/react/popover";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { fetchCollaborators } from "@/lib/github/pulls";
import { requestReview } from "@/lib/github/pulls-actions";
import type { PRCollaborator } from "@/lib/github/types";
import { cn } from "@/lib/utils";
import useSWR from "swr";

interface CollaboratorSelectorProps {
  owner: string;
  repo: string;
  prNumber: number;
  onSuccess: () => void;
}

export function CollaboratorSelector({
  owner,
  repo,
  prNumber,
  onSuccess,
}: CollaboratorSelectorProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data: collaborators = [], isLoading } = useSWR(
    [owner, repo, "collaborators"],
    ([o, r]) => fetchCollaborators(o, r),
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return collaborators;
    return collaborators.filter((c) => c.login.toLowerCase().includes(q));
  }, [collaborators, query]);

  const toggle = (login: string) => {
    setSelected((prev) =>
      prev.includes(login) ? prev.filter((l) => l !== login) : [...prev, login],
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await requestReview(owner, repo, prNumber, selected);
    setSubmitting(false);
    if (result.success) {
      setSelected([]);
      setOpen(false);
      onSuccess();
    } else {
      setSubmitError(result.error ?? "Request failed");
    }
  };

  return (
    <div className="space-y-2">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {selected.length === 0
            ? "Select reviewers…"
            : `${selected.length} selected`}
          <ChevronDown className="size-3.5 ml-1 shrink-0" />
        </Popover.Trigger>
        <Popover.Positioner side="bottom" alignment="start" sideOffset={4}>
          <Popover.Popup className="z-50 w-64 rounded-lg border bg-popover shadow-lg outline-none">
            {/* Search */}
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Search collaborators…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-52 overflow-y-auto py-1">
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isLoading && filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {query ? "No collaborators match." : "No collaborators found."}
                </p>
              )}
              {filtered.map((c: PRCollaborator) => {
                const isSelected = selected.includes(c.login);
                return (
                  <button
                    key={c.login}
                    onClick={() => toggle(c.login)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                      isSelected && "bg-muted/60",
                    )}
                  >
                    <img
                      src={c.avatarUrl}
                      alt={c.login}
                      className="size-5 rounded-full"
                    />
                    <span className="flex-1 truncate text-left">{c.login}</span>
                    {isSelected && <Check className="size-3.5 shrink-0 text-foreground" />}
                  </button>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Root>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((login) => (
            <span
              key={login}
              className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              {login}
              <button onClick={() => toggle(login)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {submitError && <p className="text-xs text-destructive">{submitError}</p>}

      {selected.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background disabled:opacity-50 hover:opacity-80 transition-opacity"
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          Request {selected.length} reviewer{selected.length > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
```

> **If Base UI Popover sub-component names differ from `Positioner`/`Popup`:** Adjust to match. Common variants: `Popover.Content` instead of `Popover.Popup`, `Popover.Anchor` instead of `Popover.Positioner`. Read the actual types file before writing.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no errors (including the previously broken `zone-reviews.tsx` import).

- [ ] **Step 4: Manual test**

1. Open a PR detail page.
2. Click "Request reviewer" — the panel expands.
3. Click the trigger button — a popover opens with a search box and collaborator list.
4. Select two collaborators, confirm chips appear below.
5. Click "Request 2 reviewers" — on success the panel closes and the reviews list refreshes.
6. Search for a user not in the collaborator list — they should not appear (only collaborators are shown by design; no free-text entry).
7. Confirm "Add review" button now navigates to the diff view with `?review=true`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/pulls/collaborator-selector.tsx
git commit -m "feat: CollaboratorSelector — searchable multi-select popover restricted to repo collaborators"
```

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|---|---|
| "Add Review" navigates to `/diff?review=true` | Task 10 |
| Review mode activated by `?review=true` param | Task 5 |
| Click line number to add inline comment | Task 6 |
| Shift-click for range selection | Task 6 (`handleLineClick`) |
| Text selection → quoted character-level comment | Task 7 |
| File header "reviewed" checkbox (localStorage) | Task 8 |
| File header "Add comment" for file-level comments | Task 8 |
| Controls only visible when review mode active | Tasks 5–9 (all gated on `reviewMode`) |
| Approve/Request Changes/Comment moved to diff bar | Task 9 (ReviewBar) |
| Draft persisted in localStorage, stale if SHA mismatch | Task 3 (ReviewDraftContext) |
| Batch line comments submitted via `pulls.createReview` | Task 9 (ReviewBar `handleSubmit`) |
| File comments via `subject_type: "file"` | Tasks 2+9 |
| "Request Reviewer" opens Base UI Popover | Task 11 |
| Suggestions from `repos.listCollaborators` only | Task 11 (`fetchCollaborators`) |
| Non-collaborators cannot be added | Task 11 (no free-text entry; list is filtered) |
| Types: `PRCollaborator`, `PendingReviewComment`, `ReviewDraft` | Task 1 |
