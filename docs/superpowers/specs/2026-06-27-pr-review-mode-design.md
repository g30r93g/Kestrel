# PR Review Mode & Collaborator Reviewer Selector — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable inline code review directly in the diff view (line/range/file comments, per-file "reviewed" tracking, review submission) and replace the plain-text reviewer input with a validated collaborator combobox.

**Architecture:** Review mode is activated via `?review=true` on the existing `/diff` route. All draft state (pending comments, marked files, review body) lives in `localStorage` and is managed through a React context. Review submission batches all line comments into a single `createReview` API call; file-level comments follow as individual `createReviewComment` calls. The collaborator selector fetches `repos.listCollaborators` on popover open and enforces membership before allowing selection.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5, Tailwind 4, Base UI (`@base-ui/react`), SWR 2, Octokit 5, lucide-react, `motion/react`

---

## Global Constraints

- All new components are `"use client"` unless they are server actions (`"use server"` at file top, `getOctokit()` outside try/catch)
- Action button style: `"flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"`
- No new dependencies — use existing Base UI, lucide-react, SWR, motion
- SWR key tuples: `[owner, repo, prNumber, "reviews" | "threads" | ...]`
- `useParams<{ owner: string; rest?: string[] }>()` — `rest[0]` = repo, `rest[2]` = prNumber
- Review mode UI (checkboxes, gutter controls, review bar, file comment button) is **only rendered** when `?review=true` is in the URL
- `localStorage` key pattern: `"review-draft:{owner}/{repo}/{prNumber}"`
- Draft is discarded silently when `draft.commitSha !== pr.headSha`

---

## File Map

### New files
- `apps/web/src/components/pulls/review-draft-context.tsx` — Context, localStorage read/write, all draft mutations
- `apps/web/src/components/pulls/review-bar.tsx` — Sticky bottom bar with submission controls
- `apps/web/src/components/pulls/inline-comment-form.tsx` — Reusable inline textarea card used for line, range, and file comments
- `apps/web/src/components/pulls/collaborator-selector.tsx` — Multi-select combobox popover for requesting reviewers

### Modified files
- `apps/web/src/components/pulls/diff-view.tsx` — Wrap with ReviewDraftProvider, add review mode logic, gutter interaction, text selection, file header controls
- `apps/web/src/components/pulls/zone-reviews.tsx` — Replace "Add Review" inline form with navigation link; replace "Request Reviewer" text input with `CollaboratorSelector`
- `apps/web/src/lib/github/pulls-actions.ts` — Extend `submitReview` to accept `comments` array and `commitId`; add `createFileComment`
- `apps/web/src/lib/github/pulls.ts` — Add `fetchCollaborators`
- `apps/web/src/lib/github/types.ts` — Add `PRCollaborator`, `PendingReviewComment` types

---

## Section 1: Types

### `types.ts` additions

```typescript
export interface PRCollaborator {
  login: string;
  avatarUrl: string;
}

export interface PendingReviewComment {
  id: string;           // local UUID (crypto.randomUUID())
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

---

## Section 2: Data Layer

### `fetchCollaborators` in `pulls.ts`

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

### `pulls-actions.ts` additions

Extend `submitReview` signature:

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
): Promise<{ success: boolean; error?: string }>
```

Add `createFileComment`:

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
    await octokit.rest.pulls.createReviewComment({
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
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
```

---

## Section 3: ReviewDraftContext

### `review-draft-context.tsx`

Exports:
- `ReviewDraftProvider` — wraps the diff view, reads/writes localStorage on every mutation
- `useReviewDraft()` — throws if used outside provider

Interface:

```typescript
interface ReviewDraftContextValue {
  draft: ReviewDraft;
  addComment: (comment: Omit<PendingReviewComment, "id">) => void;
  updateComment: (id: string, body: string) => void;
  removeComment: (id: string) => void;
  toggleFile: (filename: string) => void;
  setBody: (body: string) => void;
  clearDraft: () => void;
}
```

Storage key: `"review-draft:{owner}/{repo}/{prNumber}"`

On mount: read from localStorage, discard if `draft.commitSha !== commitSha` prop (PR head SHA passed from parent).

Every mutation: write back to localStorage via `JSON.stringify`.

Empty draft shape:

```typescript
const EMPTY_DRAFT: ReviewDraft = {
  commitSha: "",
  comments: [],
  markedFiles: [],
  body: "",
};
```

---

## Section 4: `InlineCommentForm`

### `inline-comment-form.tsx`

Props:

```typescript
interface InlineCommentFormProps {
  quotedText?: string;            // pre-filled blockquote from text selection
  initialBody?: string;           // for editing existing pending comment
  onSubmit: (body: string) => void;
  onCancel: () => void;
  submitLabel?: string;           // default "Add comment"
}
```

Renders a small card (`rounded-lg border bg-card p-3 space-y-2`) with:
- If `quotedText`: a read-only blockquote display (`border-l-2 pl-3 text-xs text-muted-foreground italic`) above the textarea
- A `<textarea>` autofocused, `min-h-[80px]`, resize-y
- Row of buttons: `[Cancel]` (ghost) `[Add comment]` (primary, disabled if body empty)

---

## Section 5: Diff View — Review Mode

### `diff-view.tsx` changes

**Provider wrap:** `DiffView` adds a new SWR call to fetch the PR:
```typescript
const { data: pr } = useSWR(
  [owner, repo, prNumber, "pr"],
  ([o, r, n]) => fetchPullRequest(o, r, n),
);
```
`reviewMode` is derived from `useSearchParams().get("review") === "true"`. Wrap the return value with `<ReviewDraftProvider owner={owner} repo={repo} prNumber={prNumber} commitSha={pr?.headSha ?? ""} enabled={reviewMode}>`.

**Line number interaction (gutter click)**

State in `DiffView`:
```typescript
const [lineSelection, setLineSelection] = useState<{
  path: string;
  anchorLine: number;
  activeLine: number;
} | null>(null);
const [openCommentAt, setOpenCommentAt] = useState<{
  path: string;
  line: number;
  startLine?: number;
} | null>(null);
```

Each line number `<span>` in `UnifiedDiff` and `SplitDiff` gains `data-line={lineNumber}`, `data-path={filePath}`, and `data-side="LEFT"|"RIGHT"` attributes. In `UnifiedDiff` all lines are `"RIGHT"`. In `SplitDiff` the left column (old) is `"LEFT"` and the right column (new) is `"RIGHT"`. In review mode, add:
- `cursor-pointer hover:bg-blue-100/60 dark:hover:bg-blue-900/20` classes
- `onClick` handler:
  ```typescript
  if (reviewMode) {
    if (e.shiftKey && lineSelection?.path === path) {
      // extend range
      const start = Math.min(lineSelection.anchorLine, line);
      const end = Math.max(lineSelection.anchorLine, line);
      setOpenCommentAt({ path, line: end, startLine: start !== end ? start : undefined });
    } else {
      setLineSelection({ path, anchorLine: line, activeLine: line });
      setOpenCommentAt({ path, line });
    }
  }
  ```
- Selected lines (between anchorLine and activeLine on the active path) get `bg-blue-50 dark:bg-blue-950/30` background

`InlineCommentForm` is rendered as an extra row immediately after the last selected line. On submit:
```typescript
addComment({
  path: openCommentAt.path,
  body,
  line: openCommentAt.line,
  startLine: openCommentAt.startLine,
  side: "RIGHT",
  startSide: openCommentAt.startLine ? "RIGHT" : undefined,
});
setOpenCommentAt(null);
setLineSelection(null);
```

**Pending comment indicators**

After rendering the inline form row, for each line that has pending comments: render a row with a speech bubble icon and the comment count. Clicking it opens a small popover/dropdown listing the pending comments with edit (re-opens `InlineCommentForm` with `initialBody`) and delete (calls `removeComment(id)`) actions.

**Text selection**

A `useEffect` in `DiffView` attaches a `mouseup` listener to the diff scroll container ref. On mouseup:

```typescript
const sel = window.getSelection();
if (!reviewMode || !sel || sel.isCollapsed) return;

// Walk the selection to find data-line and data-path attributes
const range = sel.getRangeAt(0);
const startEl = range.startContainer.parentElement?.closest("[data-line]");
const endEl = range.endContainer.parentElement?.closest("[data-line]");
if (!startEl || !endEl) { sel.removeAllRanges(); return; }

const path = startEl.getAttribute("data-path");
if (path !== endEl.getAttribute("data-path")) { sel.removeAllRanges(); return; }

const startLine = parseInt(startEl.getAttribute("data-line")!);
const endLine = parseInt(endEl.getAttribute("data-line")!);
const quotedText = sel.toString().trim();

setTextSelectionTooltip({
  path,
  line: endLine,
  startLine: startLine !== endLine ? startLine : undefined,
  quotedText,
  // position tooltip near the end of selection
  rect: range.getBoundingClientRect(),
});
sel.removeAllRanges();
```

A `textSelectionTooltip` state drives a small floating button (speech bubble icon, `absolute` positioned using `rect` relative to scroll container). Clicking it:
```typescript
setOpenCommentAt({ path, line, startLine });
setPendingQuotedText(quotedText);
setTextSelectionTooltip(null);
```

The `InlineCommentForm` then receives `quotedText={pendingQuotedText}`.

**File header changes**

`FilePatch` receives `reviewMode: boolean` prop. When true, the header row changes:

```tsx
{reviewMode && (
  <input
    type="checkbox"
    checked={draft.markedFiles.includes(file.filename)}
    onChange={() => toggleFile(file.filename)}
    className="shrink-0 rounded"
  />
)}
<span className={cn(
  "min-w-0 flex-1 truncate font-mono text-xs",
  reviewMode && draft.markedFiles.includes(file.filename) && "line-through text-muted-foreground"
)}>
  {file.filename}
</span>
{/* ... stats ... */}
{reviewMode && (
  <button
    onClick={() => setOpenFileComment(file.filename)}
    className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground ..."
  >
    <MessageSquarePlus className="size-3.5" />
    Add comment
  </button>
)}
```

File-level `InlineCommentForm` renders below the header row (above the diff content) when `openFileComment === file.filename`. On submit:
```typescript
addComment({
  path: file.filename,
  body,
  line: 1,
  side: "RIGHT",
  isFileLevel: true,
});
setOpenFileComment(null);
```

The card header row gets `bg-green-50/50 dark:bg-green-950/20` tint when the file is marked reviewed.

---

## Section 6: ReviewBar

### `review-bar.tsx`

Rendered inside `DiffView`, below the file patches scroll area, only when `reviewMode` is true.

```tsx
<div className="sticky bottom-0 border-t bg-card/95 backdrop-blur-sm px-4 py-3 flex items-center gap-4">
  {/* Status summary */}
  <span className="text-xs text-muted-foreground shrink-0">
    {draft.comments.length} comment{draft.comments.length !== 1 ? "s" : ""}
    {draft.markedFiles.length > 0 && ` · ${draft.markedFiles.length} reviewed`}
  </span>

  {/* Overall body */}
  <textarea
    value={draft.body}
    onChange={(e) => setBody(e.target.value)}
    placeholder="Leave an overall comment…"
    className="flex-1 min-h-[32px] max-h-[80px] resize-none rounded-md border bg-background px-2.5 py-1.5 text-sm ..."
  />

  {/* Action buttons */}
  <div className="flex items-center gap-2 shrink-0">
    <Button variant="outline" size="sm" onClick={handleCancel}>
      {hasDraftContent ? "Cancel" : "Exit review"}
    </Button>
    {hasDraftContent && (
      <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDiscard}>
        Discard draft
      </Button>
    )}
    <Button size="sm" onClick={() => handleSubmit("COMMENT")} disabled={submitting}>
      Comment
    </Button>
    <Button size="sm" variant="outline" onClick={() => handleSubmit("REQUEST_CHANGES")} disabled={submitting || !hasDraftContent}>
      Request changes
    </Button>
    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleSubmit("APPROVE")} disabled={submitting}>
      {submitting ? <Loader2 className="size-4 animate-spin" /> : "Approve"}
    </Button>
  </div>
</div>
```

`handleSubmit(event)`:
1. Set `submitting = true`
2. Separate `draft.comments` into `lineComments` (`!isFileLevel`) and `fileComments` (`isFileLevel`)
3. `await submitReview(owner, repo, prNumber, draft.body, event, pr.headSha, lineComments.map(...))`
4. For each `fileComments`: `await createFileComment(owner, repo, prNumber, pr.headSha, c.path, c.body)`
5. On all success: `clearDraft()`, `mutate([owner, repo, prNumber, "reviews"])`, `mutate([owner, repo, prNumber, "threads"])`, `router.push(/${owner}/${repo}/pulls/${prNumber})`
6. On any failure: set `submitError`, `submitting = false`

`handleCancel`: `router.push(/${owner}/${repo}/pulls/${prNumber})` (draft preserved)

`handleDiscard`: `clearDraft()` then navigate back

---

## Section 7: `zone-reviews.tsx` changes

**"Add Review" button** — replace the `setShowReviewForm` toggle with:
```tsx
<Link
  href={`/${owner}/${repo}/pulls/${prNumber}/diff?review=true`}
  className="flex items-center gap-1 text-xs text-muted-foreground ..."
>
  <PenLine className="size-3.5" />
  Add review
</Link>
```

Remove `showReviewForm` state, `reviewBody`, `reviewEvent`, `EVENT_BUTTONS`, `handleSubmitReview`, and the inline review form JSX entirely.

**"Request Reviewer" button** — replace with `<CollaboratorSelector owner={owner} repo={repo} prNumber={prNumber} onSuccess={invalidate} />` which renders the button itself and manages the popover internally.

---

## Section 8: CollaboratorSelector

### `collaborator-selector.tsx`

Self-contained component. Renders a link-styled button (`<UserPlus /> Request reviewer`) that opens a Base UI `Popover`.

**Popover content (300px wide):**

```
┌─────────────────────────────┐
│ [chip: octocat ×]           │  ← selected chips
├─────────────────────────────┤
│ 🔍 Search collaborators…   │  ← search input
├─────────────────────────────┤
│ ○ avatar  monalisa          │
│ ● avatar  octocat    ✓      │  ← checked = selected
│ ○ avatar  torvalds          │
│                             │
│ (if search has no match:)   │
│   "Not a collaborator"      │
├─────────────────────────────┤
│ [Request review (2)]        │  ← disabled if 0 selected
└─────────────────────────────┘
```

State:
```typescript
const [open, setOpen] = useState(false);
const [search, setSearch] = useState("");
const [collaborators, setCollaborators] = useState<PRCollaborator[]>([]);
const [selected, setSelected] = useState<string[]>([]);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

On popover open: call `fetchCollaborators(owner, repo)` (server action), store result.

Filter: `collaborators.filter(c => c.login.toLowerCase().includes(search.toLowerCase()))`

Toggle selection: add/remove login from `selected`.

Non-match state: `search.length > 0 && filtered.length === 0` → show "Not a repository collaborator — cannot request review" row.

Submit: calls `requestReview(owner, repo, prNumber, selected)`, then `onSuccess()`, resets state, closes popover.

Chips above the search input render as `<span>login <button>×</button></span>` with remove on ×.
