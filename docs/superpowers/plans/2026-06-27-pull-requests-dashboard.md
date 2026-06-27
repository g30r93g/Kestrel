# Pull Requests Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, full-width PR dashboard with a header PR switcher — no write actions, no creation flow.

**Architecture:** Client components fetch data via SWR calling `"use server"` functions (matching the `RefSelector`/`BranchesView` pattern). The PR switcher lives in `site-header.tsx` parallel to `RefSelector`, visible only on `/pulls` routes. Nine named zone cards compose the dashboard; each fetches independently so a single API failure degrades one card, not the page. Pure computations (Verdict, signal parsing) live in a separate file with no server directive so they run in the client.

**Tech Stack:** Next.js 16.2.9, React 19, Octokit 5, SWR 2, Tailwind CSS 4, Base UI (`@base-ui/react`), cmdk, lucide-react 1.21.0, TypeScript 5.

## Global Constraints

- Base UI (`@base-ui/react`) for all interactive primitives — not Radix. Study existing usage in `ref-selector.tsx` before writing Popover/Command markup.
- `"use server"` at the top of `lib/github/pulls.ts` makes every export a server action — keep pure computation in `lib/github/pulls-compute.ts` (no directive).
- `formatTimeAgo` (not `formatDistance`) from `@/lib/time`.
- Icon names must exist in `lucide-react@1.21.0` — check before use.
- No test runner. Verify correctness after each task with `npm run type-check` and `npm run lint` from `apps/web/`, then visual verification in browser with `npm run dev`.
- Read `node_modules/next/dist/docs/` for any Next.js API before using it — Next 16 has breaking changes from the training data.
- SWR key convention: `[owner, repo, identifier, "descriptor"]` tuple. Pass `null` as key to skip a fetch.

---

## File Map

**New files:**
- `apps/web/src/lib/github/pulls.ts` — all `"use server"` fetch functions
- `apps/web/src/lib/github/pulls-compute.ts` — pure `computeVerdict` and `parseSignals`
- `apps/web/src/components/pulls/pulls-view.tsx` — dashboard root, SWR orchestration, zone layout
- `apps/web/src/components/pulls/pr-switcher.tsx` — header PR switcher popover
- `apps/web/src/components/pulls/zone-identity.tsx` — Zone A
- `apps/web/src/components/pulls/zone-verdict.tsx` — Zone B
- `apps/web/src/components/pulls/zone-reviews.tsx` — Zone C
- `apps/web/src/components/pulls/zone-checks.tsx` — Zone D
- `apps/web/src/components/pulls/zone-code-delta.tsx` — Zone E
- `apps/web/src/components/pulls/zone-signals.tsx` — Zone F
- `apps/web/src/components/pulls/zone-conversation.tsx` — Zone G
- `apps/web/src/components/pulls/zone-unresolved.tsx` — Zone H
- `apps/web/src/components/pulls/zone-activity.tsx` — Zone I

**Modified files:**
- `apps/web/src/lib/github/types.ts` — append all PR types
- `apps/web/src/app/[owner]/[[...rest]]/page.tsx` — add pulls routing branch
- `apps/web/src/components/site-header.tsx` — mount `PRSwitcher` on `/pulls` route

---

### Task 1: PR Types

**Files:**
- Modify: `apps/web/src/lib/github/types.ts`

**Interfaces:**
- Produces: all PR types consumed by Tasks 2–8 — must be defined here first

- [ ] **Step 1: Append PR types to `types.ts`**

Add after the last export in the file:

```typescript
// --- Pull Requests ---

export type PRLifecycleState = "open" | "draft" | "merged" | "closed";

export type PRReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";

export type PRMergeableState = "mergeable" | "conflicting" | "unknown";

export type PRCheckStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "waiting"
  | "pending"
  | "requested";

export type PRCheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | null;

export interface PRUser {
  login: string;
  avatarUrl: string;
}

export interface PRLabel {
  name: string;
  color: string;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  state: PRLifecycleState;
  headRef: string;
  baseRef: string;
  author: PRUser;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequest extends PullRequestSummary {
  body: string;
  headSha: string;
  commitCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: PRLabel[];
  assignees: PRUser[];
  mergedAt: string | null;
  mergedBy: PRUser | null;
  autoMergeEnabled: boolean;
  mergeableState: PRMergeableState;
  behindBy: number;
  htmlUrl: string;
}

export interface PRReview {
  id: number;
  reviewer: PRUser;
  state: PRReviewState;
  submittedAt: string | null;
  body: string;
  isAutomated: boolean;
}

export interface PRCheckRun {
  id: number;
  name: string;
  status: PRCheckStatus;
  conclusion: PRCheckConclusion;
  detailsUrl: string;
  isRequired: boolean;
}

export interface PRComment {
  id: number;
  author: PRUser;
  body: string;
  createdAt: string;
}

export interface PRThread {
  id: string;
  path: string;
  line: number | null;
  isResolved: boolean;
  firstComment: PRComment;
}

export interface PRFile {
  filename: string;
  additions: number;
  deletions: number;
  status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
}

export type VerdictStatus = "READY" | "NOT_READY" | "MERGED" | "DRAFT" | "CLOSED";

export interface VerdictBlocker {
  kind: "check" | "review" | "conflict" | "threads" | "policy";
  label: string;
}

export interface VerdictState {
  status: VerdictStatus;
  blockers: VerdictBlocker[];
  notables: string[];
}

export type SignalKind =
  | "coverage"
  | "bundle"
  | "performance"
  | "security"
  | "deploy"
  | "quality"
  | "visual"
  | "dependency"
  | "automated-note";

export interface SignalChip {
  kind: SignalKind;
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  severity: "ok" | "warning" | "error";
  url?: string;
}

export interface PRActivity {
  id: string;
  type:
    | "committed"
    | "reviewed"
    | "commented"
    | "merged"
    | "closed"
    | "reopened"
    | "labeled"
    | "assigned"
    | "review_requested"
    | "base_changed"
    | "other";
  actor: PRUser | null;
  detail: string;
  createdAt: string;
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd apps/web && npm run type-check
```

Expected: no errors (types are self-contained).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/github/types.ts
git commit -m "feat(pulls): add PR type definitions"
```

---

### Task 2: PR Data Layer

**Files:**
- Create: `apps/web/src/lib/github/pulls.ts`

**Interfaces:**
- Consumes: all types from Task 1
- Produces:
  - `fetchPullRequests(owner: string, repo: string): Promise<PullRequestSummary[]>`
  - `fetchPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequest | null>`
  - `fetchPullRequestReviews(owner: string, repo: string, pullNumber: number): Promise<PRReview[]>`
  - `fetchPullRequestChecks(owner: string, repo: string, headSha: string, baseRef: string): Promise<PRCheckRun[]>`
  - `fetchPullRequestComments(owner: string, repo: string, pullNumber: number): Promise<{ humanComments: PRComment[]; botComments: Array<{ login: string; body: string }> }>`
  - `fetchPullRequestThreads(owner: string, repo: string, pullNumber: number): Promise<PRThread[]>`
  - `fetchPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<PRFile[]>`
  - `fetchPullRequestActivity(owner: string, repo: string, pullNumber: number): Promise<PRActivity[]>`

- [ ] **Step 1: Create `pulls.ts`**

```typescript
"use server";

import { getOctokit } from "./client";
import type {
  PullRequest,
  PullRequestSummary,
  PRActivity,
  PRCheckConclusion,
  PRCheckRun,
  PRCheckStatus,
  PRComment,
  PRFile,
  PRLifecycleState,
  PRMergeableState,
  PRReview,
  PRReviewState,
  PRThread,
  PRUser,
} from "./types";

// Logins that post automated comments — filtered out of human conversation (Zone G)
// and routed to signal parsing (Zone F) instead.
const BOT_LOGINS = new Set([
  "vercel[bot]",
  "netlify[bot]",
  "codecov[bot]",
  "github-actions[bot]",
  "dependabot[bot]",
  "snyk-bot",
  "sonarcloud[bot]",
  "coderabbitai[bot]",
  "copilot-swe-agent[bot]",
  "coveralls",
  "imgbot[bot]",
  "renovate[bot]",
  "allcontributors[bot]",
  "changeset-bot[bot]",
  "release-drafter[bot]",
]);

// Logins whose reviews are informational (AI reviewers) — shown in a demoted
// sub-lane in Zone C, never counted toward branch-protection requirements.
const AUTOMATED_REVIEWER_LOGINS = new Set([
  "copilot-swe-agent[bot]",
  "coderabbitai[bot]",
  "github-advanced-security[bot]",
]);

function toState(
  state: string,
  draft: boolean,
  mergedAt: string | null,
): PRLifecycleState {
  if (mergedAt) return "merged";
  if (draft) return "draft";
  return state as "open" | "closed";
}

export async function fetchPullRequests(
  owner: string,
  repo: string,
): Promise<PullRequestSummary[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 50,
    });
    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: toState(pr.state, pr.draft ?? false, pr.merged_at ?? null),
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      author: {
        login: pr.user?.login ?? "ghost",
        avatarUrl: pr.user?.avatar_url ?? "",
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function fetchPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequest | null> {
  const octokit = await getOctokit();
  try {
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    const { data: comparison } = await octokit.rest.repos
      .compareCommits({
        owner,
        repo,
        base: pr.base.ref,
        head: pr.head.sha,
      })
      .catch(() => ({ data: { behind_by: 0 } }));

    const mergeableState: PRMergeableState =
      pr.mergeable_state === "clean" || pr.mergeable_state === "unstable"
        ? "mergeable"
        : pr.mergeable_state === "dirty"
          ? "conflicting"
          : "unknown";

    return {
      number: pr.number,
      title: pr.title,
      state: toState(pr.state, pr.draft ?? false, pr.merged_at ?? null),
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      author: {
        login: pr.user?.login ?? "ghost",
        avatarUrl: pr.user?.avatar_url ?? "",
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      body: pr.body ?? "",
      headSha: pr.head.sha,
      commitCount: pr.commits,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
      assignees: (pr.assignees ?? []).map((a) => ({
        login: a.login,
        avatarUrl: a.avatar_url,
      })),
      mergedAt: pr.merged_at ?? null,
      mergedBy: pr.merged_by
        ? { login: pr.merged_by.login, avatarUrl: pr.merged_by.avatar_url }
        : null,
      autoMergeEnabled: pr.auto_merge !== null,
      mergeableState,
      behindBy: comparison.behind_by ?? 0,
      htmlUrl: pr.html_url,
    };
  } catch {
    return null;
  }
}

export async function fetchPullRequestReviews(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRReview[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return data.map((r) => ({
      id: r.id,
      reviewer: {
        login: r.user?.login ?? "ghost",
        avatarUrl: r.user?.avatar_url ?? "",
      },
      state: r.state as PRReviewState,
      submittedAt: r.submitted_at ?? null,
      body: r.body,
      isAutomated: AUTOMATED_REVIEWER_LOGINS.has(r.user?.login ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchPullRequestChecks(
  owner: string,
  repo: string,
  headSha: string,
  baseRef: string,
): Promise<PRCheckRun[]> {
  const octokit = await getOctokit();
  try {
    const [{ data: checksData }, branchProtection] = await Promise.all([
      octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: headSha,
        per_page: 100,
      }),
      octokit.rest.repos
        .getBranchProtection({ owner, repo, branch: baseRef })
        .then((res) => res.data)
        .catch(() => null),
    ]);

    const requiredNames = new Set<string>(
      branchProtection?.required_status_checks?.contexts ?? [],
    );

    return checksData.check_runs.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status as PRCheckStatus,
      conclusion: (c.conclusion ?? null) as PRCheckConclusion,
      detailsUrl: c.details_url ?? "",
      isRequired: requiredNames.has(c.name),
    }));
  } catch {
    return [];
  }
}

export async function fetchPullRequestComments(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{
  humanComments: PRComment[];
  botComments: Array<{ login: string; body: string }>;
}> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    });

    const humanComments: PRComment[] = [];
    const botComments: Array<{ login: string; body: string }> = [];

    for (const c of data) {
      const login = c.user?.login ?? "";
      if (BOT_LOGINS.has(login) || login.endsWith("[bot]")) {
        botComments.push({ login, body: c.body ?? "" });
      } else {
        humanComments.push({
          id: c.id,
          author: { login, avatarUrl: c.user?.avatar_url ?? "" },
          body: c.body ?? "",
          createdAt: c.created_at,
        });
      }
    }

    return { humanComments, botComments };
  } catch {
    return { humanComments: [], botComments: [] };
  }
}

interface ThreadsGQLResult {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: Array<{
          id: string;
          isResolved: boolean;
          path: string;
          line: number | null;
          comments: {
            nodes: Array<{
              author: { login: string; avatarUrl: string } | null;
              body: string;
              createdAt: string;
            }>;
          };
        }>;
      };
    } | null;
  };
}

export async function fetchPullRequestThreads(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRThread[]> {
  const octokit = await getOctokit();
  try {
    const result = await octokit.graphql<ThreadsGQLResult>(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 50) {
              nodes {
                id
                isResolved
                path
                line
                comments(first: 1) {
                  nodes {
                    author { login avatarUrl }
                    body
                    createdAt
                  }
                }
              }
            }
          }
        }
      }`,
      { owner, repo, number: pullNumber },
    );

    const nodes =
      result.repository.pullRequest?.reviewThreads.nodes ?? [];

    return nodes.map((t) => {
      const first = t.comments.nodes[0];
      return {
        id: t.id,
        path: t.path,
        line: t.line,
        isResolved: t.isResolved,
        firstComment: {
          id: 0,
          author: {
            login: first?.author?.login ?? "ghost",
            avatarUrl: first?.author?.avatarUrl ?? "",
          },
          body: first?.body ?? "",
          createdAt: first?.createdAt ?? "",
        },
      };
    });
  } catch {
    return [];
  }
}

export async function fetchPullRequestFiles(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRFile[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    return data.map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status as PRFile["status"],
    }));
  } catch {
    return [];
  }
}

function mapEventType(event: string): PRActivity["type"] {
  switch (event) {
    case "committed": return "committed";
    case "review_requested": return "review_requested";
    case "reviewed": return "reviewed";
    case "commented": return "commented";
    case "merged": return "merged";
    case "closed": return "closed";
    case "reopened": return "reopened";
    case "labeled":
    case "unlabeled": return "labeled";
    case "assigned":
    case "unassigned": return "assigned";
    case "base_ref_changed": return "base_changed";
    default: return "other";
  }
}

export async function fetchPullRequestActivity(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRActivity[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.issues.listEvents({
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    });
    return data.map((e, i) => ({
      id: String(e.id ?? i),
      type: mapEventType(e.event ?? ""),
      actor: e.actor
        ? { login: e.actor.login, avatarUrl: e.actor.avatar_url }
        : null,
      detail: e.event ?? "",
      createdAt: (e as { created_at?: string }).created_at ?? "",
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd apps/web && npm run type-check
```

Expected: no errors. If Octokit types complain about a property (e.g. `behind_by`), check `node_modules/octokit/` for the actual response type and adjust the cast or field name.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/github/pulls.ts
git commit -m "feat(pulls): add PR data layer (fetch functions)"
```

---

### Task 3: Verdict Computation + Signal Parsing

**Files:**
- Create: `apps/web/src/lib/github/pulls-compute.ts`

**Interfaces:**
- Consumes: `PullRequest`, `PRReview`, `PRCheckRun`, `PRThread`, `VerdictState`, `SignalChip` from Task 1
- Produces:
  - `computeVerdict(pr: PullRequest, reviews: PRReview[], checks: PRCheckRun[], threads: PRThread[]): VerdictState`
  - `parseSignals(botComments: Array<{ login: string; body: string }>): SignalChip[]`

- [ ] **Step 1: Create `pulls-compute.ts`**

```typescript
import type {
  PullRequest,
  PRReview,
  PRCheckRun,
  PRThread,
  SignalChip,
  VerdictBlocker,
  VerdictState,
} from "./types";

export function computeVerdict(
  pr: PullRequest,
  reviews: PRReview[],
  checks: PRCheckRun[],
  threads: PRThread[],
): VerdictState {
  if (pr.state === "merged") return { status: "MERGED", blockers: [], notables: [] };
  if (pr.state === "closed") return { status: "CLOSED", blockers: [], notables: [] };
  if (pr.state === "draft") return { status: "DRAFT", blockers: [], notables: [] };

  const blockers: VerdictBlocker[] = [];
  const notables: string[] = [];

  // Required checks
  const failingRequired = checks.filter(
    (c) => c.isRequired && c.conclusion === "failure",
  );
  if (failingRequired.length > 0) {
    const names = failingRequired.map((c) => c.name).join(", ");
    blockers.push({
      kind: "check",
      label: `${failingRequired.length} check${failingRequired.length > 1 ? "s" : ""} failing (${names})`,
    });
  }

  const runningRequired = checks.filter(
    (c) => c.isRequired && c.status !== "completed",
  );
  if (runningRequired.length > 0 && failingRequired.length === 0) {
    notables.push(
      `${runningRequired.length} check${runningRequired.length > 1 ? "s" : ""} running`,
    );
  }

  // Reviews — collapse to latest decision per human reviewer
  const latestByReviewer = new Map<string, PRReview>();
  for (const r of reviews.filter((r) => !r.isAutomated)) {
    const existing = latestByReviewer.get(r.reviewer.login);
    if (
      !existing ||
      (r.submittedAt ?? "") > (existing.submittedAt ?? "")
    ) {
      latestByReviewer.set(r.reviewer.login, r);
    }
  }
  const changesRequested = [...latestByReviewer.values()].filter(
    (r) => r.state === "CHANGES_REQUESTED",
  );
  if (changesRequested.length > 0) {
    blockers.push({
      kind: "review",
      label: `Changes requested by ${changesRequested.map((r) => `@${r.reviewer.login}`).join(", ")}`,
    });
  }

  // Merge conflicts
  if (pr.mergeableState === "conflicting") {
    blockers.push({ kind: "conflict", label: "Merge conflicts" });
  }

  // Notables
  const unresolvedCount = threads.filter((t) => !t.isResolved).length;
  if (unresolvedCount > 0) {
    notables.push(
      `${unresolvedCount} unresolved thread${unresolvedCount > 1 ? "s" : ""}`,
    );
  }
  if (pr.behindBy > 0) {
    notables.push(
      `${pr.behindBy} commit${pr.behindBy > 1 ? "s" : ""} behind base`,
    );
  }
  if (pr.autoMergeEnabled) {
    notables.push("Auto-merge armed");
  }

  return {
    status: blockers.length === 0 ? "READY" : "NOT_READY",
    blockers,
    notables,
  };
}

export function parseSignals(
  botComments: Array<{ login: string; body: string }>,
): SignalChip[] {
  const chips: SignalChip[] = [];

  for (const { login, body } of botComments) {
    // Deploy preview — Vercel / Netlify
    if (login === "vercel[bot]" || login === "netlify[bot]") {
      const urlMatch =
        body.match(/https?:\/\/[^\s)>"]+\.(?:vercel|netlify)\.app[^\s)>"]*/) ??
        null;
      const isError = /(?:❌|failed|error)/i.test(body);
      const isReady = /(?:✅|ready|deployed)/i.test(body);
      chips.push({
        kind: "deploy",
        label: login === "vercel[bot]" ? "Vercel" : "Netlify",
        value: isError ? "Failed" : isReady ? "Ready" : "Building",
        severity: isError ? "error" : isReady ? "ok" : "warning",
        url: urlMatch?.[0],
      });
      continue;
    }

    // Coverage — Codecov / Coveralls
    if (login === "codecov[bot]" || login === "coveralls") {
      const totalMatch = body.match(/(\d+(?:\.\d+)?)\s*%/);
      const deltaMatch = body.match(/([+-]\d+(?:\.\d+)?)\s*%/);
      if (totalMatch) {
        const total = parseFloat(totalMatch[1]);
        const deltaNum = deltaMatch ? parseFloat(deltaMatch[1]) : 0;
        chips.push({
          kind: "coverage",
          label: "Coverage",
          value: `${totalMatch[1]}%`,
          delta: deltaMatch?.[1],
          deltaDirection:
            deltaNum > 0 ? "up" : deltaNum < 0 ? "down" : "neutral",
          severity: total < 60 ? "error" : total < 80 ? "warning" : "ok",
        });
      }
      continue;
    }

    // Fallback — any other recognised or unknown bot
    chips.push({
      kind: "automated-note",
      label: login.replace(/\[bot\]$/, ""),
      value: "Note",
      severity: "ok",
    });
  }

  // Deduplicate: keep last chip per kind (except automated-note, keyed by label)
  const seen = new Map<string, SignalChip>();
  for (const chip of chips) {
    const key =
      chip.kind === "automated-note"
        ? `automated-note:${chip.label}`
        : chip.kind;
    seen.set(key, chip);
  }
  return [...seen.values()];
}
```

- [ ] **Step 2: Verify**

```bash
cd apps/web && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/github/pulls-compute.ts
git commit -m "feat(pulls): add Verdict computation and signal parsing"
```

---

### Task 4: PR Switcher + Header Integration

**Files:**
- Create: `apps/web/src/components/pulls/pr-switcher.tsx`
- Modify: `apps/web/src/components/site-header.tsx`

**Interfaces:**
- Consumes: `fetchPullRequests` (Task 2), `PullRequestSummary` (Task 1)
- Produces: `<PRSwitcher />` component, mounted in header on `/pulls` routes

- [ ] **Step 1: Create `pr-switcher.tsx`**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { fetchPullRequests } from "@/lib/github/pulls";
import type { PullRequestSummary } from "@/lib/github/types";
import {
  CircleDot,
  ChevronsUpDown,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Plus,
} from "lucide-react";
import {
  useParams,
  usePathname,
  useRouter,
} from "next/navigation";
import { useEffect, useState } from "react";

// Owner-level slugs that are never repo names — mirrors ref-selector.tsx.
const RESERVED = new Set([
  "review", "pulls", "assigned", "mentions",
  "checks", "repositories", "projects", "teams",
]);

type PRFilter = "open" | "merged" | "draft";

function PRStateIcon({ state }: { state: PullRequestSummary["state"] }) {
  if (state === "merged")
    return <GitMerge className="size-3.5 shrink-0 text-purple-500" />;
  if (state === "closed")
    return <GitPullRequestClosed className="size-3.5 shrink-0 text-muted-foreground" />;
  if (state === "draft")
    return <CircleDot className="size-3.5 shrink-0 text-muted-foreground" />;
  return <GitPullRequest className="size-3.5 shrink-0 text-green-500" />;
}

export function PRSwitcher() {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const pathname = usePathname();
  const router = useRouter();

  const owner = params.owner;
  const first = params.rest?.[0];
  const repo = first && !RESERVED.has(first) ? first : undefined;
  // segments: [repo, "pulls", prNumber?]
  const prNumberStr = params.rest?.[2];
  const currentNumber =
    prNumberStr && /^\d+$/.test(prNumberStr)
      ? parseInt(prNumberStr, 10)
      : undefined;

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<PRFilter>("open");
  const [prs, setPRs] = useState<PullRequestSummary[]>([]);

  useEffect(() => {
    if (!owner || !repo) return;
    let cancelled = false;
    fetchPullRequests(owner, repo).then((data) => {
      if (!cancelled) setPRs(data);
    });
    return () => {
      cancelled = true;
    };
  }, [owner, repo]);

  if (!repo) return null;

  const filtered = prs.filter((pr) => pr.state === filter);
  const current = prs.find((pr) => pr.number === currentNumber);
  const triggerLabel = current
    ? `#${current.number} ${current.title}`
    : "Pull requests";

  const select = (pr: PullRequestSummary) => {
    setOpen(false);
    // Build the canonical pulls URL: /{owner}/{repo}/pulls/{number}
    // The current pathname always contains /pulls somewhere; replace the segment after it.
    const parts = pathname.split("/");
    const pullsIdx = parts.lastIndexOf("pulls");
    if (pullsIdx !== -1) {
      parts[pullsIdx + 1] = String(pr.number);
      router.push(parts.slice(0, pullsIdx + 2).join("/"));
    }
  };

  return (
    <>
      <Separator
        orientation="vertical"
        className="mx-1 data-[orientation=vertical]:h-4"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 font-medium"
            />
          }
        >
          <GitPullRequest className="size-4 shrink-0" />
          <span className="max-w-40 truncate">{triggerLabel}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>

        <PopoverContent align="start" className="w-72 p-0">
          {/* Pinned "New pull request" — not a CommandItem so it is never
              filtered out by the search query */}
          <button
            className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => {
              setOpen(false);
              router.push(`/${owner}/${repo}/pulls/new`);
            }}
          >
            <Plus className="size-4" />
            New pull request
          </button>

          <Command>
            <CommandInput placeholder="Search pull requests…" />

            {/* Filter tab strip */}
            <div className="flex border-b text-xs">
              {(["open", "merged", "draft"] as const).map((f) => (
                <button
                  key={f}
                  className={[
                    "flex-1 py-1.5 capitalize transition-colors",
                    filter === f
                      ? "border-b-2 border-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <CommandList>
              <CommandEmpty>No pull requests.</CommandEmpty>
              <CommandGroup>
                {filtered.map((pr) => (
                  <CommandItem
                    key={pr.number}
                    value={`${pr.number} ${pr.title}`}
                    data-checked={
                      pr.number === currentNumber ? "true" : undefined
                    }
                    onSelect={() => select(pr)}
                  >
                    <PRStateIcon state={pr.state} />
                    <span className="truncate">
                      #{pr.number} {pr.title}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
```

- [ ] **Step 2: Add `PRSwitcher` to `site-header.tsx`**

The current `site-header.tsx` is:

```typescript
"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { RefSelector } from "@/components/ref-selector";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Command, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isCodeTab = /\/[^/]+\/[^/]+\/code(\/|$)/.test(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        {isCodeTab && <RefSelector />}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Command palette"><Command className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Inbox"><Bell className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Create"><Plus className="size-4" /></Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
```

Replace it with:

```typescript
"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { PRSwitcher } from "@/components/pulls/pr-switcher";
import { RefSelector } from "@/components/ref-selector";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Command, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isCodeTab = /\/[^/]+\/[^/]+\/code(\/|$)/.test(pathname);
  // Show PRSwitcher on /pulls and /pulls/{number} but not /pulls/new (creation route)
  const isPullsTab = /\/[^/]+\/[^/]+\/pulls(\/\d+.*|$)/.test(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        {isCodeTab && <RefSelector />}
        {isPullsTab && <PRSwitcher />}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Command palette"><Command className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Inbox"><Bell className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Create"><Plus className="size-4" /></Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd apps/web && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Smoke test in browser**

```bash
cd apps/web && npm run dev
```

Navigate to `/{owner}/{repo}/pulls`. Confirm the PR switcher appears in the header. Open it — the `+ New pull request` row should be pinned at the top, the filter tabs below it. Selecting a PR should route to `/{owner}/{repo}/pulls/{number}`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/pulls/pr-switcher.tsx apps/web/src/components/site-header.tsx
git commit -m "feat(pulls): add PR switcher to site header"
```

---

### Task 5: Routing + PullsView Skeleton

**Files:**
- Modify: `apps/web/src/app/[owner]/[[...rest]]/page.tsx`
- Create: `apps/web/src/components/pulls/pulls-view.tsx`

**Interfaces:**
- Consumes: all fetch functions (Task 2), `computeVerdict` + `parseSignals` (Task 3), zone components (Tasks 6–8, which don't exist yet — add stub imports now and wire up as zones are built)
- Produces: `<PullsView owner repo prNumber />`, routed from `page.tsx`

- [ ] **Step 1: Add pulls routing to `page.tsx`**

Add before the `const model = resolveNav(...)` line in `page.tsx`:

```typescript
import { PullsView } from "@/components/pulls/pulls-view";
```

Add this routing branch before the final fallback return:

```typescript
  // Pull requests: /{owner}/{repo}/pulls[/{number}]
  if (segments.length >= 2 && segments[1] === "pulls") {
    const repo = segments[0];
    const prNumberStr = segments[2];

    // /pulls/new is the creation route (Plan 3 — not yet implemented)
    if (prNumberStr === "new") {
      return (
        <div className="p-4 md:p-6">
          <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            PR creation coming soon.
          </div>
        </div>
      );
    }

    const prNumber = prNumberStr ? parseInt(prNumberStr, 10) : undefined;
    return <PullsView owner={owner} repo={repo} prNumber={prNumber} />;
  }
```

- [ ] **Step 2: Create `pulls-view.tsx` skeleton**

This mounts all nine zones. Zones built in later tasks are imported as they exist; the component compiles at each task because SWR data is always optional (`?? []` / `?? null`). Build the full orchestration now so later tasks only add zone files.

```typescript
"use client";

import { computeVerdict, parseSignals } from "@/lib/github/pulls-compute";
import {
  fetchPullRequest,
  fetchPullRequestActivity,
  fetchPullRequestChecks,
  fetchPullRequestComments,
  fetchPullRequestFiles,
  fetchPullRequestReviews,
  fetchPullRequestThreads,
} from "@/lib/github/pulls";
import { GitPullRequest } from "lucide-react";
import useSWR from "swr";
import { ZoneIdentity } from "./zone-identity";
import { ZoneVerdict } from "./zone-verdict";
import { ZoneReviews } from "./zone-reviews";
import { ZoneChecks } from "./zone-checks";
import { ZoneCodeDelta } from "./zone-code-delta";
import { ZoneSignals } from "./zone-signals";
import { ZoneConversation } from "./zone-conversation";
import { ZoneUnresolved } from "./zone-unresolved";
import { ZoneActivity } from "./zone-activity";

interface PullsViewProps {
  owner: string;
  repo: string;
  prNumber: number | undefined;
}

export function PullsView({ owner, repo, prNumber }: PullsViewProps) {
  const on = prNumber !== undefined;

  const { data: pr, error: prErr, isLoading: prLoading } = useSWR(
    on ? [owner, repo, prNumber, "pr"] : null,
    ([o, r, n]) => fetchPullRequest(o, r, n),
  );

  const { data: reviews = [], error: reviewsErr, isLoading: reviewsLoading } = useSWR(
    on ? [owner, repo, prNumber, "reviews"] : null,
    ([o, r, n]) => fetchPullRequestReviews(o, r, n),
  );

  const { data: checks = [], error: checksErr, isLoading: checksLoading } = useSWR(
    on && pr ? [owner, repo, pr.headSha, pr.baseRef, "checks"] : null,
    ([o, r, sha, base]) => fetchPullRequestChecks(o, r, sha, base),
  );

  const { data: commentsData, error: commentsErr, isLoading: commentsLoading } = useSWR(
    on ? [owner, repo, prNumber, "comments"] : null,
    ([o, r, n]) => fetchPullRequestComments(o, r, n),
  );

  const { data: threads = [], error: threadsErr, isLoading: threadsLoading } = useSWR(
    on ? [owner, repo, prNumber, "threads"] : null,
    ([o, r, n]) => fetchPullRequestThreads(o, r, n),
  );

  const { data: files = [], error: filesErr, isLoading: filesLoading } = useSWR(
    on ? [owner, repo, prNumber, "files"] : null,
    ([o, r, n]) => fetchPullRequestFiles(o, r, n),
  );

  const { data: activity = [], error: activityErr, isLoading: activityLoading } = useSWR(
    on ? [owner, repo, prNumber, "activity"] : null,
    ([o, r, n]) => fetchPullRequestActivity(o, r, n),
  );

  if (!prNumber) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <GitPullRequest className="size-10 opacity-30" />
        <p className="text-sm">
          Select a pull request from the header to get started.
        </p>
      </div>
    );
  }

  const humanComments = commentsData?.humanComments ?? [];
  const botComments = commentsData?.botComments ?? [];
  const signals = parseSignals(botComments);
  const verdict = pr ? computeVerdict(pr, reviews, checks, threads) : null;
  const unresolvedThreads = threads.filter((t) => !t.isResolved);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6 [scrollbar-gutter:stable]">
      <ZoneIdentity
        pr={pr ?? null}
        loading={prLoading}
        error={!!prErr}
      />
      <ZoneVerdict
        verdict={verdict}
        loading={prLoading}
        error={!!prErr}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ZoneReviews
          reviews={reviews}
          loading={reviewsLoading}
          error={!!reviewsErr}
        />
        <ZoneChecks
          checks={checks}
          loading={checksLoading}
          error={!!checksErr}
        />
        <ZoneCodeDelta
          pr={pr ?? null}
          files={files}
          loading={prLoading || filesLoading}
          error={!!filesErr}
        />
      </div>
      <ZoneSignals
        chips={signals}
        loading={commentsLoading}
        error={!!commentsErr}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ZoneConversation
          comments={humanComments}
          loading={commentsLoading}
          error={!!commentsErr}
        />
        <ZoneUnresolved
          threads={unresolvedThreads}
          loading={threadsLoading}
          error={!!threadsErr}
        />
      </div>
      <ZoneActivity
        events={activity}
        loading={activityLoading}
        error={!!activityErr}
      />
    </div>
  );
}
```

**Note:** This file imports zone components that don't exist yet. TypeScript will error until Tasks 6–8 are complete. Build the zone stubs in Task 6 first so `type-check` passes.

- [ ] **Step 3: Verify**

After Task 6 zone stubs exist, run:

```bash
cd apps/web && npm run type-check && npm run lint
```

- [ ] **Step 4: Commit** (after Task 6 so type-check is green)

Commit together with Task 6.

---

### Task 6: Zone A (Identity) + Zone B (Verdict)

**Files:**
- Create: `apps/web/src/components/pulls/zone-identity.tsx`
- Create: `apps/web/src/components/pulls/zone-verdict.tsx`

**Interfaces:**
- Consumes: `PullRequest`, `VerdictState` (Task 1)
- Produces:
  - `<ZoneIdentity pr={PullRequest | null} loading={boolean} error={boolean} />`
  - `<ZoneVerdict verdict={VerdictState | null} loading={boolean} error={boolean} />`

- [ ] **Step 1: Create `zone-identity.tsx`**

```typescript
"use client";

import type { PullRequest } from "@/lib/github/types";
import { formatTimeAgo } from "@/lib/time";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CircleDot,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
} from "lucide-react";

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

interface ZoneIdentityProps {
  pr: PullRequest | null;
  loading: boolean;
  error: boolean;
}

export function ZoneIdentity({ pr, loading, error }: ZoneIdentityProps) {
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
    <div className="flex gap-3 rounded-lg border bg-card p-4">
      <StateIcon state={pr.state} />
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold leading-snug">
          {pr.title}{" "}
          <span className="font-normal text-muted-foreground">
            #{pr.number}
          </span>
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{pr.author.login}</span>
          {" wants to merge "}
          <code className="rounded bg-muted px-1 text-xs">{pr.headRef}</code>
          {" → "}
          <code className="rounded bg-muted px-1 text-xs">{pr.baseRef}</code>
          {" · "}
          {pr.commitCount} {pr.commitCount === 1 ? "commit" : "commits"}
          {" · opened "}
          {formatTimeAgo(pr.createdAt)}
          {pr.updatedAt !== pr.createdAt && (
            <> · updated {formatTimeAgo(pr.updatedAt)}</>
          )}
        </p>
        {pr.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
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
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `zone-verdict.tsx`**

```typescript
"use client";

import type { VerdictState } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  CircleDot,
  GitMerge,
  XCircle,
  X,
} from "lucide-react";

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

interface ZoneVerdictProps {
  verdict: VerdictState | null;
  loading: boolean;
  error: boolean;
}

export function ZoneVerdict({ verdict, loading, error }: ZoneVerdictProps) {
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

  return (
    <div className={`rounded-lg border bg-card p-4 ${config.className}`}>
      <div className="flex items-center gap-2">
        {config.icon}
        <span className="font-semibold">{config.label}</span>
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
    </div>
  );
}
```

- [ ] **Step 3: Verify and commit (including Task 5)**

```bash
cd apps/web && npm run type-check && npm run lint
```

Expected: no errors (zone-reviews/checks/etc. stubs are added in the next task, so add them as empty components first if type-check errors remain — see below).

If `pulls-view.tsx` errors because later zone files don't exist, create minimal stubs:

```bash
# Only if type-check errors on missing zone files
for zone in zone-reviews zone-checks zone-code-delta zone-signals zone-conversation zone-unresolved zone-activity; do
cat > "apps/web/src/components/pulls/${zone}.tsx" << 'EOF'
export function Zone() { return null; }
EOF
done
```

Then rename exports to match what `pulls-view.tsx` imports: `ZoneReviews`, `ZoneChecks`, etc.

```bash
git add apps/web/src/app/[owner]/\[\[...rest\]\]/page.tsx \
        apps/web/src/components/pulls/pulls-view.tsx \
        apps/web/src/components/pulls/zone-identity.tsx \
        apps/web/src/components/pulls/zone-verdict.tsx
git commit -m "feat(pulls): routing, dashboard skeleton, Zone A identity, Zone B verdict"
```

- [ ] **Step 4: Visual check in browser**

Navigate to `/{owner}/{repo}/pulls/1` (use a real PR number). Confirm:
- Zone A shows PR title, state icon, author, branch refs, commit count, age
- Zone B shows the synthesised verdict (READY / NOT READY / MERGED / DRAFT / CLOSED) with blockers and notables
- Zones C–I are absent or stubbed (expected at this stage)

---

### Task 7: Zone C (Reviews) + Zone D (Checks) + Zone E (Code Delta)

**Files:**
- Create: `apps/web/src/components/pulls/zone-reviews.tsx`
- Create: `apps/web/src/components/pulls/zone-checks.tsx`
- Create: `apps/web/src/components/pulls/zone-code-delta.tsx`

**Interfaces:**
- Consumes: `PRReview`, `PRCheckRun`, `PullRequest`, `PRFile` (Task 1)
- Produces:
  - `<ZoneReviews reviews={PRReview[]} loading error />`
  - `<ZoneChecks checks={PRCheckRun[]} loading error />`
  - `<ZoneCodeDelta pr={PullRequest | null} files={PRFile[]} loading error />`

- [ ] **Step 1: Create `zone-reviews.tsx`**

```typescript
"use client";

import type { PRReview } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/time";
import {
  CheckCircle2,
  CircleDot,
  MessageSquare,
  XCircle,
} from "lucide-react";

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

interface ZoneReviewsProps {
  reviews: PRReview[];
  loading: boolean;
  error: boolean;
}

export function ZoneReviews({ reviews, loading, error }: ZoneReviewsProps) {
  // Collapse to latest review per reviewer
  const latestByReviewer = new Map<string, PRReview>();
  for (const r of reviews.filter((r) => !r.isAutomated)) {
    const existing = latestByReviewer.get(r.reviewer.login);
    if (!existing || (r.submittedAt ?? "") > (existing.submittedAt ?? "")) {
      latestByReviewer.set(r.reviewer.login, r);
    }
  }
  const humanReviews = [...latestByReviewer.values()];
  const automatedReviews = reviews.filter(
    (r) => r.isAutomated && !latestByReviewer.has(r.reviewer.login),
  );

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Reviews</h2>

      {error && (
        <p className="text-xs text-destructive">Reviews unavailable.</p>
      )}

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
            {automatedReviews.slice(0, 3).map((r) => (
              <li
                key={r.reviewer.login}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <CircleDot className="size-3 shrink-0" />
                {r.reviewer.login}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `zone-checks.tsx`**

```typescript
"use client";

import type { PRCheckRun } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";

function CheckIcon({ run }: { run: PRCheckRun }) {
  if (run.status !== "completed")
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  if (run.conclusion === "success" || run.conclusion === "neutral" || run.conclusion === "skipped")
    return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
  if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "action_required")
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  return <CircleDot className="size-4 shrink-0 text-muted-foreground" />;
}

interface ZoneChecksProps {
  checks: PRCheckRun[];
  loading: boolean;
  error: boolean;
}

export function ZoneChecks({ checks, loading, error }: ZoneChecksProps) {
  const requiredChecks = checks.filter((c) => c.isRequired);
  const allChecksCount = checks.length;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Checks</h2>

      {error && (
        <p className="text-xs text-destructive">
          Checks unavailable.{" "}
          <a href="https://github.com" className="underline" target="_blank" rel="noreferrer">
            View on GitHub
          </a>
        </p>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      )}

      {!loading && !error && requiredChecks.length === 0 && allChecksCount === 0 && (
        <p className="text-xs text-muted-foreground">No checks configured.</p>
      )}

      {!loading && !error && requiredChecks.length === 0 && allChecksCount > 0 && (
        <p className="text-xs text-muted-foreground">
          No required checks — {allChecksCount} informational.
        </p>
      )}

      <ul className="space-y-2">
        {requiredChecks.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-sm">
            <CheckIcon run={c} />
            <span className="flex-1 truncate">{c.name}</span>
            {c.conclusion === "failure" && c.detailsUrl && (
              <a
                href={c.detailsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
              >
                Logs <ExternalLink className="size-3" />
              </a>
            )}
          </li>
        ))}
      </ul>

      {allChecksCount > requiredChecks.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          +{allChecksCount - requiredChecks.length} informational checks
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `zone-code-delta.tsx`**

Sensitive surfaces that, when touched, warrant a flag in the risk summary:

```typescript
"use client";

import type { PRFile, PullRequest } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, FileCode } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const RISKY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /migration/i, label: "migrations" },
  { pattern: /auth/i, label: "auth" },
  { pattern: /\.env|secrets?/i, label: "secrets / env" },
  { pattern: /\.github\/workflows\//i, label: "CI config" },
  { pattern: /package-lock\.json|yarn\.lock|pnpm-lock/i, label: "lockfiles" },
  { pattern: /schema\.(ts|js|prisma|sql)/i, label: "schema" },
];

function detectRiskySurfaces(files: PRFile[]): string[] {
  const found = new Set<string>();
  for (const f of files) {
    for (const { pattern, label } of RISKY_PATTERNS) {
      if (pattern.test(f.filename)) found.add(label);
    }
  }
  return [...found];
}

function topDirs(files: PRFile[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const dir = f.filename.includes("/")
      ? f.filename.split("/").slice(0, 2).join("/")
      : "(root)";
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([dir]) => dir);
}

interface ZoneCodeDeltaProps {
  pr: PullRequest | null;
  files: PRFile[];
  loading: boolean;
  error: boolean;
}

export function ZoneCodeDelta({ pr, files, loading, error }: ZoneCodeDeltaProps) {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2];
  const diffHref =
    owner && repo && prNumber
      ? `/${owner}/${repo}/pulls/${prNumber}/diff`
      : "#";

  const riskySurfaces = detectRiskySurfaces(files);
  const dirs = topDirs(files);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Code Delta</h2>

      {error && (
        <p className="text-xs text-destructive">Diff stats unavailable.</p>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}

      {!loading && !error && pr && (
        <>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-mono text-green-600">+{pr.additions}</span>
            <span className="font-mono text-red-500">−{pr.deletions}</span>
            <span className="text-muted-foreground">
              · {pr.changedFiles} file{pr.changedFiles !== 1 ? "s" : ""}
            </span>
          </div>

          {dirs.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Heavy: {dirs.join(", ")}
            </p>
          )}

          {riskySurfaces.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              touches {riskySurfaces.join(", ")}
            </div>
          )}

          <Link
            href={diffHref}
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
          >
            <FileCode className="size-3.5" />
            Open diff
          </Link>
        </>
      )}

      {!loading && !error && !pr && (
        <p className="text-xs text-muted-foreground">No file changes.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
cd apps/web && npm run type-check && npm run lint
```

- [ ] **Step 5: Visual check**

Navigate to `/{owner}/{repo}/pulls/{number}`. Confirm the 3-column row shows:
- Zone C: reviewer list with state icons and human-readable state labels; automated reviewers demoted
- Zone D: required checks with pass/fail/running icons; log links on failures
- Zone E: +/− stats, risky surface flags, "Open diff" link

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/pulls/zone-reviews.tsx \
        apps/web/src/components/pulls/zone-checks.tsx \
        apps/web/src/components/pulls/zone-code-delta.tsx
git commit -m "feat(pulls): Zone C reviews, Zone D checks, Zone E code delta"
```

---

### Task 8: Zones F–I + Final Loading/Error Polish

**Files:**
- Create: `apps/web/src/components/pulls/zone-signals.tsx`
- Create: `apps/web/src/components/pulls/zone-conversation.tsx`
- Create: `apps/web/src/components/pulls/zone-unresolved.tsx`
- Create: `apps/web/src/components/pulls/zone-activity.tsx`

**Interfaces:**
- Consumes: `SignalChip`, `PRComment`, `PRThread`, `PRActivity` (Task 1)
- Produces:
  - `<ZoneSignals chips={SignalChip[]} loading error />`
  - `<ZoneConversation comments={PRComment[]} loading error />`
  - `<ZoneUnresolved threads={PRThread[]} loading error />`
  - `<ZoneActivity events={PRActivity[]} loading error />`

- [ ] **Step 1: Create `zone-signals.tsx`**

```typescript
"use client";

import type { SignalChip } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Shield,
  Globe,
  BarChart3,
  Package,
  Brush,
  Eye,
  Bot,
} from "lucide-react";

const KIND_ICON: Record<string, React.ReactNode> = {
  coverage: <BarChart3 className="size-3.5" />,
  bundle: <Package className="size-3.5" />,
  performance: <BarChart3 className="size-3.5" />,
  security: <Shield className="size-3.5" />,
  deploy: <Globe className="size-3.5" />,
  quality: <Brush className="size-3.5" />,
  visual: <Eye className="size-3.5" />,
  dependency: <Package className="size-3.5" />,
  "automated-note": <Bot className="size-3.5" />,
};

const SEVERITY_CLASS: Record<SignalChip["severity"], string> = {
  ok: "border-border text-foreground",
  warning: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
  error: "border-destructive/50 text-destructive",
};

function DeltaIcon({ dir }: { dir?: SignalChip["deltaDirection"] }) {
  if (dir === "up") return <ArrowUp className="size-3" />;
  if (dir === "down") return <ArrowDown className="size-3" />;
  return <Minus className="size-3" />;
}

interface ZoneSignalsProps {
  chips: SignalChip[];
  loading: boolean;
  error: boolean;
}

export function ZoneSignals({ chips, loading, error }: ZoneSignalsProps) {
  if (!loading && !error && chips.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Signals</h2>

      {error && (
        <p className="text-xs text-destructive">Signal data unavailable.</p>
      )}

      {loading && (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip, i) => (
            <a
              key={i}
              href={chip.url ?? "#"}
              target={chip.url ? "_blank" : undefined}
              rel="noreferrer"
              className={[
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-opacity",
                SEVERITY_CLASS[chip.severity],
                chip.url ? "hover:opacity-80" : "cursor-default",
              ].join(" ")}
            >
              {KIND_ICON[chip.kind] ?? <Bot className="size-3.5" />}
              <span className="font-medium">{chip.label}</span>
              <span>{chip.value}</span>
              {chip.delta && (
                <span className="flex items-center gap-0.5 opacity-70">
                  <DeltaIcon dir={chip.deltaDirection} />
                  {chip.delta}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `zone-conversation.tsx`**

```typescript
"use client";

import type { PRComment } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/time";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PREVIEW_COUNT = 5;

interface ZoneConversationProps {
  comments: PRComment[];
  loading: boolean;
  error: boolean;
}

export function ZoneConversation({
  comments,
  loading,
  error,
}: ZoneConversationProps) {
  const preview = comments.slice(-PREVIEW_COUNT);
  const hiddenCount = Math.max(0, comments.length - PREVIEW_COUNT);

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Conversation</h2>

      {error && (
        <p className="text-xs text-destructive">Comments unavailable.</p>
      )}

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

      {!loading && !error && comments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No discussion yet — start the conversation below.
        </p>
      )}

      {!loading && !error && (
        <ul className="flex flex-col gap-4">
          {hiddenCount > 0 && (
            <li className="text-xs text-muted-foreground">
              {hiddenCount} earlier comment{hiddenCount > 1 ? "s" : ""} — view full thread for context
            </li>
          )}
          {preview.map((c) => (
            <li key={c.id}>
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  @{c.author.login}
                </span>
                <span>·</span>
                <span>{formatTimeAgo(c.createdAt)}</span>
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
    </div>
  );
}
```

- [ ] **Step 3: Create `zone-unresolved.tsx`**

```typescript
"use client";

import type { PRThread } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, MessageSquareMore } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface ZoneUnresolvedProps {
  threads: PRThread[]; // already filtered to isResolved === false
  loading: boolean;
  error: boolean;
}

export function ZoneUnresolved({ threads, loading, error }: ZoneUnresolvedProps) {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const repo = params.rest?.[0];
  const prNumber = params.rest?.[2];
  const diffBase =
    owner && repo && prNumber
      ? `/${owner}/${repo}/pulls/${prNumber}/diff`
      : null;

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Unresolved Threads</h2>

      {error && (
        <p className="text-xs text-destructive">Thread status unavailable.</p>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {!loading && !error && threads.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 text-green-500" />
          All threads resolved
        </div>
      )}

      {!loading && !error && threads.length > 0 && (
        <ul className="space-y-2">
          {threads.map((t) => {
            const href = diffBase
              ? `${diffBase}#${encodeURIComponent(t.path)}`
              : "#";
            return (
              <li key={t.id}>
                <Link
                  href={href}
                  className="flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <MessageSquareMore className="mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono">
                      {t.path}
                      {t.line != null ? `:${t.line}` : ""}
                    </span>
                    {t.firstComment.body && (
                      <p className="mt-0.5 truncate text-muted-foreground/70">
                        {t.firstComment.body.slice(0, 80)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `zone-activity.tsx`**

```typescript
"use client";

import type { PRActivity } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/time";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitCommitHorizontal,
  GitMerge,
  MessageSquare,
  X,
} from "lucide-react";
import { useState } from "react";

function ActivityIcon({ type }: { type: PRActivity["type"] }) {
  switch (type) {
    case "committed": return <GitCommitHorizontal className="size-3.5 shrink-0 text-muted-foreground" />;
    case "reviewed": return <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />;
    case "commented": return <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />;
    case "merged": return <GitMerge className="size-3.5 shrink-0 text-purple-500" />;
    case "closed": return <X className="size-3.5 shrink-0 text-red-500" />;
    default: return <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />;
  }
}

interface ZoneActivityProps {
  events: PRActivity[];
  loading: boolean;
  error: boolean;
}

export function ZoneActivity({ events, loading, error }: ZoneActivityProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="flex w-full items-center gap-2 p-4 text-left text-sm font-medium"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        Activity
        {!expanded && events.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            · {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          {error && (
            <p className="text-xs text-destructive">Activity unavailable.</p>
          )}

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <p className="text-xs text-muted-foreground">No activity yet.</p>
          )}

          {!loading && !error && (
            <ul className="space-y-2">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <ActivityIcon type={e.type} />
                  <div className="min-w-0 flex-1">
                    {e.actor && (
                      <span className="font-medium text-foreground">
                        @{e.actor.login}{" "}
                      </span>
                    )}
                    <span>{e.detail}</span>
                  </div>
                  <span className="shrink-0">{formatTimeAgo(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify everything**

```bash
cd apps/web && npm run type-check && npm run lint
```

Expected: no errors across all new files.

- [ ] **Step 6: Full visual test**

```bash
cd apps/web && npm run dev
```

Navigate to `/{owner}/{repo}/pulls`. Verify:
1. Header PR switcher appears. Opening it shows `+ New pull request` pinned at top, filter tabs (open/merged/draft), searchable list.
2. Selecting a PR routes to `/{owner}/{repo}/pulls/{number}`.
3. Zone A shows PR title, state icon, author, branches, commit count, age, labels.
4. Zone B shows synthesised verdict with blockers and notables.
5. Zone C shows reviewer states; automated reviewers in demoted sub-section.
6. Zone D shows required checks with icons and log links on failures.
7. Zone E shows ±stats, risky surface flags, "Open diff" link.
8. Zone F shows signal chips from bot comments (vercel, codecov, etc.).
9. Zone G shows only human comments (bots absent); truncated to last 5.
10. Zone H shows unresolved threads by file:line; "All threads resolved ✓" when empty.
11. Zone I is collapsed by default; expands to event list.
12. `/pulls` with no PR number shows the empty state ("Select a pull request…").
13. Each zone fails gracefully in isolation — refresh with a bad network condition to verify.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/pulls/zone-signals.tsx \
        apps/web/src/components/pulls/zone-conversation.tsx \
        apps/web/src/components/pulls/zone-unresolved.tsx \
        apps/web/src/components/pulls/zone-activity.tsx
git commit -m "feat(pulls): Zone F signals, Zone G conversation, Zone H unresolved, Zone I activity"
```
