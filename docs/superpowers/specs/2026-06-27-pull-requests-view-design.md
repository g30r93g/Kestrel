# Pull Requests View — Design Spec

**Date:** 2026-06-27
**Status:** Approved IA, pending implementation plan

---

## Thesis

A PR is a **decision object, not a document.** GitHub answers "what happened here?" (a transcript). This view answers "what is true now, and what do I do about it?" (a dashboard).

The three moves that get us there:

1. **Synthesize the Verdict** — don't scatter merge-readiness across components and make the reader compute it; show the conclusion, components one layer beneath.
2. **Separate gates from reports, bots from humans** — machines populate typed widgets, humans populate conversation.
3. **Tier ruthlessly** — root view is a complete mental model; evidence is one calm step away, never in the way.

---

## Navigation

### Between PRs — header PR switcher

A PR switcher lives in the site header (parallel to the existing `RefSelector` for branches), visible only when on the `/pulls` route. It is the sole PR-selection mechanism — there is no master list sidebar.

The switcher popover is searchable and groups PRs (Yours / Review-requested / Recently viewed). Each row shows the synthesised Verdict glyph so the reader can identify the PR that needs them without opening it.

```
[⎇ #125 Fix auth bug ▾]
┌───────────────────────────────┐
│ 🔍  Search pull requests...   │
├─── Open ──── Merged ── Draft ─┤
│ ✓ #125  Fix auth bug          │  ← current
│   #124  Add dark mode         │
│   #122  Refactor API client   │
│ ─────────────────────────── │
│   #121  Update dependencies   │  ← merged
└───────────────────────────────┘
```

### Within a PR — sub-routes for evidence

The root (`/[owner]/[repo]/pulls/[number]`) is the dashboard. Drill-downs are real routes:

| Route | Content |
|---|---|
| `.../[number]` | Dashboard (default) |
| `.../[number]/diff` | Full diff / code review surface |
| `.../[number]/diff/[path]` | Single-file diff |
| `.../[number]/checks/[checkId]` | Check log detail |
| `.../[number]/signals/[type]` | Coverage / bundle / security / etc. detail |
| `.../[number]/discussion` | Full human-only transcript |
| `.../[number]/commits` | Commit list and per-commit diff |
| `.../[number]/activity` | Full event timeline |

A condensed **Verdict rail** stays pinned across all sub-routes so merge-readiness is never more than a glance away, even deep in the diff. The rail contains: PR number + title, lifecycle state badge, the one-line blocking summary (or "Ready to merge"), and the primary action button.

### Quick peeks — drawers

Content that doesn't deserve a full route change opens in a side drawer:
- A single review thread
- A signal's quick-detail card (e.g. per-file coverage breakdown)
- A check's tail-of-log

**Decision rule:** evidence you'd link to or spend minutes in → route. A quick peek → drawer. A small "more" → inline expansion.

---

## Root view — the panel system

Full-width canvas. Nine named zones in three priority tiers.

```
┌─── A · Identity ──────────────────────────────────────────────────────────────┐
│ #482  Refactor auth flow  ● Open  feat/auth → main  @george · 3 commits · 2d  │
└───────────────────────────────────────────────────────────────────────────────┘
┌─── B · The Verdict ───────────────────────────────────────────────────────────┐
│ ● NOT READY                                                                   │
│ Blocking: ✗ e2e  ·  ◷ review @alice pending  ·  ⚠ 2 unresolved threads       │
│ [ Update branch ]  [ Enable auto-merge ]                                      │
└───────────────────────────────────────────────────────────────────────────────┘
┌─── C · Reviews ──────────┐  ┌─── D · Gates ───────────┐  ┌─── E · Code Delta ─┐
│ ✓ @bob  approved         │  │ ✓ build   ✓ unit        │  │ +412 −180  14 files │
│ ◷ @alice  pending  (1d)  │  │ ✗ e2e → logs            │  │ heavy: src/auth/*   │
│ ✎ @carol  changes req.   │  │ ◷ deploy   ⋯ lint       │  │ ⚑ touches migrations│
└──────────────────────────┘  └─────────────────────────┘  └─────────────────────┘
┌─── F · Signals ───────────────────────────────────────────────────────────────┐
│ Coverage 82.4% ▼2.1%   Bundle 248kB ▲12kB⚠   Security +1 high⚠               │
│ Perf 98→97             Quality A→A            Preview ▸ pr-482.app  ● ready   │
└───────────────────────────────────────────────────────────────────────────────┘
┌─── G · Conversation ─────────────────────────────┐  ┌─── H · Unresolved ──────┐
│ @alice: should we keep the legacy fallback?      │  │ 2 threads need answers  │
│ @george: yes for one release, see #471           │  │ auth/login.ts:88        │
│ @bob: lgtm once e2e is green                     │  │ auth/session.ts:12      │
└──────────────────────────────────────────────────┘  └─────────────────────────┘
┌─── I · Activity (collapsed) ──────────────────────────────────────────────────┐
│ ▸ 23 events                                                                   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Zone specifications

**A · Identity Bar (Tier 1)**
PR number, title, lifecycle state, head → base refs, author, commit count, opened/updated timestamps, linked issues. Always-visible orientation anchor. Thin and dense by design — it makes everything below interpretable.

**B · The Verdict (Tier 1, 3-second read)**
One synthesised readiness state: `READY` / `NOT READY` / `MERGED` / `DRAFT` / `BLOCKED BY POLICY`. A blocking list (only things that prevent merge, each a deep link), a non-blocking-but-notable line (behind base, merge method, auto-merge state), and the primary action cluster. Kestrel computes merge-readiness from all relevant dimensions and states the *conclusion*; GitHub shows the components and makes the reader compute it. This is the central departure.

**C · Reviews (Tier 2)**
Required count vs satisfied. Each reviewer with state (approved / changes requested / pending) and wait time. Automated reviewers (Copilot, CodeRabbit) shown in a clearly demoted sub-lane — they don't satisfy branch protection and must not borrow human authority.

**D · Checks / Gates (Tier 2)**
Required and policy-required checks *only*. Pass/fail/running, direct log links for failures. Informational checks live in Signals, not here. A failing required gate is a blocker and appears in the Verdict.

**E · Code Delta (Tier 2)**
Additions/deletions, file count, a risk/shape summary: which directories dominate, flags for sensitive surfaces (migrations, lockfiles, CI config, auth, public API). Reviewers triage by surface area and blast radius; surfacing "touches migrations / auth" up front is risk intelligence GitHub makes you discover by scrolling the file tree.

**F · Signals (Tier 2)**
Structured chip row for every automated report that previously polluted the conversation. Each chip: current value + Δ vs base + severity colour. Types:

| Signal class | Examples | Widget shows |
|---|---|---|
| Coverage | Codecov, Coveralls | total %, Δ, uncovered new lines |
| Bundle / size | size-limit, bundlephobia | total bytes, Δ, budget breaches |
| Performance | Lighthouse, perf benchmarks | scores, Δ, regressions |
| Security | Snyk, CodeQL (non-gating), Socket | new vulns by severity |
| Deploy preview | Vercel, Netlify, Render | environment, live URL, build state |
| Code quality | SonarCloud, Codacy | grade, new code smells, Δ |
| Visual / a11y | Chromatic, Percy, axe | changed snapshots, violations |
| Dependency | release-please, changesets | version bump, changelog preview |

**G · Conversation (Tier 2)**
Human comments only — no bots, no status updates. Shows the most recent N with a link to the full thread. The signal-to-noise ratio is inverted from GitHub's by §F.

**H · Unresolved Threads (Tier 2 → drill)**
Count and list of unresolved review threads, each anchored to file:line, jumping into the diff. Open threads are often the true blocker even when checks are green. Pulling them out of inline-diff burial makes the author's to-do list explicit.

**I · Activity / Timeline (Tier 3, collapsed)**
Full event stream — pushes, force-pushes, label/assignee/milestone changes, review requests, base changes, references. Collapsed by default, expandable inline. Temporal state is summarised in A and C ("updated 4m ago", "pending 1d") and detailed here.

---

## Bot / human separation

### The rule

> A piece of content belongs in **Conversation** only if it is a human exercising judgment. Everything a machine emits is a **Signal** and is routed to a typed widget. The transcript never shows a bot.

### Mechanics

- **Gates** (required status/check runs): binary, blocking, merge-relevant — live in D.
- **Reports** (bot comments, external status payloads): analog, informational, trend-bearing — live in F.
- **Ingestion:** recognised bots matched by app slug / login against a registry (`vercel[bot]`, `codecov[bot]`, `github-actions[bot]`, etc.). Their comment payloads are parsed and mapped into Signal widgets. The raw comment is accessible via "view source" for debugging/trust.
- **Fallback:** unrecognised bot → generic "Automated note" lane in F, never in G. One-click reclassification available.
- **AI reviewers** (Copilot, CodeRabbit): Signal, not reviewer. Shown in a demoted sub-lane in C or in F. Never counted toward branch-protection reviewer requirements.

---

## PR state dimensions

Enumerated for completeness — all 11 are surfaced somewhere on the dashboard:

| # | Dimension | Primary zone |
|---|---|---|
| 1 | Lifecycle state (open/draft/merged/closed) | A, B |
| 2 | Mergeability — git conflicts, behind base | B |
| 3 | Review state — approved/changes/pending, who's blocking | B, C |
| 4 | Check / gate state — required checks pass/fail | B, D |
| 5 | Branch-protection policy — rules and which are unmet | B |
| 6 | Code delta — size, risk, surface area | E |
| 7 | Discussion health — open threads, unanswered questions | B, H |
| 8 | Bot signal state — coverage, bundle, security, deploy, perf | F |
| 9 | Authorship & provenance — who, what branch, linked issues, commits | A |
| 10 | Temporal state — stale, fast-moving, waiting on whom how long | A, C |
| 11 | Merge intent/config — squash/merge/rebase, auto-merge, delete branch | B |

---

## Empty / loading / error states

Principle: **a zone never lies by omission.** "No data" and "failed to load" look different. Absence of a signal is itself information.

| Zone | Loading | Legitimately empty | Error |
|---|---|---|---|
| A | skeleton | n/a (always present) | minimal id from cache + retry |
| B | "Evaluating readiness…" neutral glyph | n/a | "Couldn't compute readiness — inputs unavailable" + which + retry; never shows false-green |
| C | reviewer-row skeletons | "No reviewers yet" + assign action | "Reviews unavailable" + retry; don't imply zero reviews |
| D | "Waiting for checks…" | "No checks configured" (distinct from running) | "Checks unavailable" + link to GitHub |
| E | size-bar skeleton | "No file changes" (empty PR) | "Diff stats unavailable" + retry |
| F | per-chip shimmer | per-signal "Not reported" chip (greyed) — not 0% | per-signal error chip; one failing signal never blanks the row |
| G | comment skeletons | "No discussion yet" + composer | "Comments unavailable" + retry |
| H | count skeleton | "All threads resolved ✓" (positive empty state) | "Thread status unavailable" |
| I | collapsed, lazy | n/a | error shown inline on expand |

Cross-cutting:
- **Draft PRs:** Verdict suppresses merge framing, shows "Draft — not seeking merge"; gates still render as preview.
- **Merged/closed PRs:** Verdict freezes to historical outcome ("Merged by @x, 2d ago, squash"); action clusters demoted.
- **Stale/cached data:** subtle "as of HH:MM" per zone, not a full-page block. Zones refresh independently.
- **Partial failure:** one dead upstream degrades one card, never the page.

---

## Layout adaptivity

- **Desktop wide:** A and B full-width; C/D/E in a 3-up row; F full-width; G/H in a 2-up row; I full-width collapsed.
- **Tablet:** C/D/E collapse to 2-up then 1-up; everything else full-width.
- **Mobile:** vertical stack in priority order; Verdict floats as a sticky summary chip; F collapses to a horizontally-scrollable chip row.

Each zone is a card with a consistent grammar: title, one-glance summary line, "drill" action. This regularity is what makes 30-second skimming reliable.

---

## User actions

### Interaction friction tiers

Every action is assigned to exactly one friction tier based on reversibility and social weight:

- **Optimistic** — apply immediately, silent rollback + toast on failure. For high-frequency, low-stakes actions (reactions, labels, resolve thread).
- **Undo-window** — apply immediately, show a 6s "Undo" toast. For non-destructive but surprising actions (subscribe, mark read, delete branch post-merge).
- **Confirmed** — require a dialog before executing. For destructive or socially heavy actions (merge, close, rebase/force-push).

### Surfacing vocabulary

- *inline button* — always visible
- *hover-reveal* — appears on row/card hover or focus
- *overflow menu* — the `⋯` grouped menu
- *split-button* — primary action + adjacent dropdown caret for variants
- *popover* — lightweight anchored panel
- *drawer* — side sheet
- *inline form* — expands in place
- *route* — navigates to a sub-page
- *command palette* — global `⌘K` action surface

### Permission model

When a viewer lacks permission, **edit chrome is omitted entirely** (no greyed buttons in A/F/G). The exception is B: a disabled merge button with a tooltip reason is informative ("waiting on 1 review"). Disabled-with-reason is for "you could, but a condition blocks it." Hidden is for "you can't, ever."

| Capability | Read-only | PR author | Write / collaborator | Maintainer / admin |
|---|---|---|---|---|
| React, comment, reply | ✓ | ✓ | ✓ | ✓ |
| Edit / delete own comment | — | ✓ | ✓ | ✓ |
| Edit / delete others' comment, hide | — | — | — | ✓ |
| Edit title / body | — | ✓ | ✓ | ✓ |
| Labels / assignees / milestone / project / lock / pin | — | partial | partial | ✓ |
| Request / remove reviewers | — | ✓ (suggested) | ✓ | ✓ |
| Submit review (approve / changes requested) | — | — (can't approve own) | ✓ | ✓ |
| Resolve / unresolve thread | — | ✓ | ✓ | ✓ |
| Merge / close / convert draft / auto-merge | — | close / draft own | ✓ | ✓ |
| Update / delete / restore branch | — | ✓ (own) | ✓ | ✓ |
| Re-run / cancel checks | — | sometimes | ✓ | ✓ |
| Dismiss review, dismiss security alert, change base | — | — | partial | ✓ |

### 1 · Merge & lifecycle

| Action | Class | Zone & surfacing | Friction | Notes |
|---|---|---|---|---|
| **Merge PR** | Essential | **B** — dominant **split-button**; label reflects chosen method | Confirmed | Disabled with tooltip when Verdict ≠ READY. On success: B → MERGED, delete-branch affordance surfaces. |
| **Choose merge method** | Essential | Caret on merge split-button → popover (merge commit / squash / rebase); repo-disallowed methods hidden | — | Default to repo's configured method; persist last-used as hint. |
| **Edit merge commit message** | Extended | Inside merge confirm dialog — collapsible "Edit commit message" | — | Pre-filled from PR title + commit log. Only for merge-commit and squash. |
| **Enable auto-merge** | Essential | **B** — split-button secondary option when NOT READY; "Auto-merge armed" notable chip when active | Optimistic | Shows method picker. Once armed, B shows a **Disable** affordance. |
| **Disable auto-merge** | Essential | **B** — inline link on "Auto-merge armed" notable | Optimistic + undo | — |
| **Close PR** | Essential | **B** — overflow `⋯` (never a bare button) | Confirmed | B → CLOSED; primary cluster becomes Reopen. |
| **Reopen PR** | Essential | **B** — primary cluster when CLOSED | Optimistic | Disabled if head branch deleted; shows "Restore branch" hint. |
| **Convert to draft** | Essential | **B / A** — overflow `⋯` | Optimistic | B → DRAFT; merge affordance suppressed; C reviewers become optional. |
| **Mark ready for review** | Essential | **B** — primary action when DRAFT | Optimistic | Re-triggers required reviewer/check evaluation; Verdict recomputes. |
| **Delete head branch after merge** | Essential | **B** — MERGED state card inline button | Undo-window | Suppressed if branch is protected or already deleted. |
| **Restore deleted branch** | Extended | **B / A** — once branch is deleted | Optimistic | — |

**Clutter resolution:** B shows one dominant primary action driven by current state. Close / convert-to-draft / edit-merge-message all live behind the `⋯` overflow.

### 2 · Review actions

| Action | Class | Zone & surfacing | Friction | Notes |
|---|---|---|---|---|
| **Request reviewer** | Essential | **C** — `+ Request` button → searchable popover (users/teams, CODEOWNERS pinned) | Optimistic | Adds pending row to C. Write permission or author requesting from suggested set. |
| **Re-request review** | Essential | **C** — hover-reveal `↻` on each reviewer row (esp. stale or approved-then-changed) | Optimistic | Resets that reviewer's wait-time clock. |
| **Remove requested reviewer** | Extended | **C** — hover-reveal `✕` on a pending reviewer row, or row overflow | Optimistic + undo | — |
| **Submit review** (approve / comment / request changes) | Essential | **B** — `Review` split-button adjacent to merge; opens a **drawer** with radio + body. Also reachable from C header. | Explicit submit | One form, three outcomes. On approve: C row flips, may clear a B blocker. |
| **Dismiss a review** | Extended | **C** — row overflow → "Dismiss review" with required reason | Confirmed | Maintainer only. Removes corresponding B blocker. |
| **Add inline comment on diff** | Essential | **Diff sub-route** — gutter `+` on line hover / line-range drag | Optimistic | Not on root dashboard. Pending-review state bubbles back to C as a "review in progress" chip. |
| **Reply to a review thread** | Essential | **H** — each thread row expands to an **inline reply form** | Optimistic | Full context on diff sub-route. |
| **Resolve thread** | Essential | **H** — `Resolve` button per thread row | Undo-window | Decrements H count; clears any "N unresolved" B blocker/notable; may flip Verdict to READY. |
| **Unresolve thread** | Extended | **H** (when showing resolved) / diff sub-route | Optimistic | Re-increments count. |
| **Quote reply** | Extended | **H / G** — comment overflow → "Quote reply" | — | Prefills reply form with `>` block. |
| **Apply / commit a suggestion** | Extended | **H** thread row when it contains a suggestion → `Commit suggestion` inline | Confirmed | Creates a commit on head branch; bumps A commit count; re-runs checks. Batchable. |
| **Request review from Copilot** | Extended | **C** automated sub-lane header → "Ask Copilot to review" | Optimistic | Demoted sub-lane; not the human reviewer list. |

**Clutter resolution:** all per-line review lives on `/diff`. Root carries only aggregates (C states, H thread list). One `Review` entry point on B avoids scattering approve/comment/request-changes across zones.

### 3 · Conversation actions

| Action | Class | Zone & surfacing | Friction | Notes |
|---|---|---|---|---|
| **Add top-level comment** | Essential | **G** — persistent **composer** at the foot of the zone | Explicit submit | Markdown + preview tab. Optimistic append. |
| **Edit own comment** | Essential | **G** — hover-reveal overflow → "Edit" → inline form | Optimistic | Shows "edited" marker. Author or maintainer. |
| **Delete own comment** | Essential | **G** — overflow → "Delete" | Confirmed | Irreversible. Maintainers can delete others'. |
| **React with emoji** | Essential | **G / H** — hover-reveal `🙂+` at comment corner → emoji popover; existing pills are click-to-toggle | Optimistic | Frequency earns its own hover affordance (not buried in overflow). |
| **Quote reply** | Extended | **G** — comment overflow → prefills composer | — | — |
| **Copy link to comment** | Extended | **G** — comment overflow → "Copy link" | Optimistic + toast | — |
| **Hide / minimize comment** | Extended | **G** — overflow (maintainer only) → "Hide" with reason select | Optimistic | Collapses comment with reason label. |
| **Mention / `#` reference autocomplete** | Essential | Inside any composer | — | Part of the composer, not a separate affordance. |
| **Attach file / paste image** | Extended | Composer toolbar / paste handler | — | Upload progress inline. |

**Clutter resolution:** G shows "most recent N humans only." Per-comment actions are hover-reveal behind a single overflow *except* react, which earns its own always-on-hover affordance.

### 4 · Metadata actions

| Action | Class | Zone & surfacing | Friction | Notes |
|---|---|---|---|---|
| **Set / remove labels** | Essential | **A** — label chips + hover-reveal `+` / gear → multi-select popover with search | Optimistic | Read-only viewers see chips, no `+`. Write permission. |
| **Set assignees** | Essential | **A** — assignee avatars + hover-reveal `+` → people popover | Optimistic | Distinct from reviewers (C). |
| **Set milestone** | Extended | **A** — "Milestone" field → popover list | Optimistic | Single-select. |
| **Link to project** | Extended | **A** — "Projects" field → popover; status field inline once linked | Optimistic | — |
| **Edit title** | Essential | **A** — hover-reveal pencil on title → click-to-edit inline | Optimistic | Enter to save / Esc to cancel. Updates A and Verdict Rail live. Author/maintainer. |
| **Edit description** | Essential | **A** — "Edit description" in overflow → **drawer** with markdown editor | Explicit save | Author/maintainer. |
| **Lock conversation** | Extended | **A / G** — overflow → "Lock conversation" with reason select | Confirmed | Maintainer. G composer disabled with lock banner. |
| **Unlock conversation** | Extended | **G** lock banner → "Unlock" | Optimistic | Maintainer. |
| **Pin PR** | Extended | **A** — overflow → "Pin" | Optimistic | Maintainer, repo-level. |
| **Edit linked issues** | Extended | **A** — "Linked issues" field → search popover | Optimistic | Manual link/unlink; also auto-parsed from body. |

**Clutter resolution:** A is read-first. Editing affordances are hover-reveal (`+`, pencil, gear), clustered into a right-aligned metadata strip so edit controls don't pepper the bar. Non-maintainers see zero edit chrome.

### 5 · Branch actions

| Action | Class | Zone & surfacing | Friction | Notes |
|---|---|---|---|---|
| **Update branch from base (merge)** | Essential | **B** — "behind base" notable carries an inline `Update branch` split-button | Confirmed | Optimistic-pending ("Updating…"); on success notable clears and checks re-run. |
| **Update branch from base (rebase)** | Extended | Caret option on update split-button | Confirmed | Force-push warning dialog: "This rewrites the branch history of `feature/x`. Collaborators must re-pull." |
| **Delete head branch** | Essential | Post-merge in **B**; also **A** head-ref hover-reveal overflow | Undo-window | See §1 post-merge affordance. |
| **Restore deleted branch** | Extended | **B / A** once deleted | Optimistic | — |
| **Change base branch** | Extended | **A** — small caret on base ref → "Change base" using existing RefSelector component | Confirmed | Recomputes diff, checks, conflicts. Heavy action; not a prominent button. |

### 6 · Check / CI actions

| Action | Class | Zone & surfacing | Friction | Notes |
|---|---|---|---|---|
| **Re-run a failed check** | Essential | **D** — hover-reveal `↻` on a failed/errored row | Optimistic | Row → "queued/running". Write permission. |
| **Re-run all failed checks** | Essential | **D** — zone header `Re-run failed` (appears only when ≥1 failure) | Optimistic | Single click; batches all failures. |
| **Re-run all checks** | Extended | **D** — zone header overflow → "Re-run all" | Confirmed | Cost/time consideration. |
| **Cancel a running check** | Extended | **D** — hover-reveal `✕` on a running row | Optimistic | → "cancelling". |
| **View check logs** | Essential | **D** — failed rows carry an always-visible `View log` → **route** `/checks/[id]` | — | Never hover-hidden on failures — it's the point. |
| **View check on provider** | Extended | **D** — row overflow → "Open in \<provider\>" | — | External link. |
| **Approve a deployment gate** | Extended | **D** — a gated row shows `Review deployment` → popover to approve/reject | Confirmed | Environment-reviewer permission. Can flip a B blocker. |

**Clutter resolution:** D shows required checks only. A footer `Show all N checks` routes to the full checks view — no inline expansion.

### 7 · Signals actions

| Action | Class | Zone & surfacing | Friction | Notes |
|---|---|---|---|---|
| **Open signal detail** | Essential | **F** — each chip is clickable → **route** `/signals/[type]` | — | Whole chip is the hit target. |
| **Dismiss a security alert** | Extended | **F** — chip hover-reveal overflow → "Dismiss" with reason (won't fix / false positive / used in tests) | Confirmed | Security-write permission. Chip → muted state; may clear a B blocker. |
| **Acknowledge / snooze a signal** | Extended | **F** — chip overflow → "Snooze on this PR" | Optimistic | Visually demotes chip. Non-destructive. |

**Clutter resolution:** F is a scan row. Mutating actions are hover-reveal overflow on the chip only — never inline buttons.

### 8 · Navigation & view actions

| Action | Class | Zone & surfacing | Friction | Notes |
|---|---|---|---|---|
| **Switch to another PR** | Essential | **Site header** PR switcher | — | Global nav; not a zone action. |
| **Open full diff** | Essential | **E** — the whole panel / "N files changed" stat is a link → `/diff` | — | Also a global keyboard shortcut. |
| **Open commits list** | Essential | **A** — commit-count stat → `/commits` | — | — |
| **Open full discussion** | Essential | **G** — footer "View full thread" → `/discussion` | — | — |
| **Open full activity** | Essential | **I** — expands inline or footer link → `/activity` | — | Lazy-load. |
| **Copy PR link** | Essential | **A** overflow → "Copy link" | Optimistic + toast | — |
| **Open on GitHub** | Essential | **A** overflow → "Open on GitHub" | — | Always available as escape hatch. |
| **Subscribe / unsubscribe** | Essential | **A** overflow → toggle | Undo-window | Shows current state. |
| **Copy branch name / checkout command** | Extended | **A** head-ref hover-reveal overflow → "Copy checkout command" | Optimistic + toast | — |
| **Collapse / expand a zone** | Extended | Each Tier-2/3 zone header chevron | — | Pure view state; persisted per-user. I defaults collapsed. |
| **Refresh** | Essential | Passive live subscription; manual `↻` in header as fallback | — | Reconciles optimistic states on reconnect. |

---

## PR creation flow

### Overview

Creation is the one PR action that exists before a PR has a number, so it cannot live inside the number-scoped dashboard. The entry point is inside the switcher popover because "start a new PR" and "jump to another PR" are the same mental gesture: *change which PR I'm looking at.* The switcher is the canonical "PR context" control; creation is just selecting a PR that does not exist yet.

**Responsibility split:**
- The **switcher popover** owns the *intent* (`+ New pull request`) and the first, highest-friction decision (base ← head) inline — branch pairing is a *selection* gesture native to the popover idiom.
- A **dedicated route** (`/[owner]/[repo]/pulls/new`) owns the *form* — the full creation surface is too rich, too tall, and too important-to-deep-link for a popover or drawer.

### Entry point — `+ New pull request`

A pinned action row at the very top of the popover, above the search field and tab strip, separated by a divider. It is visually distinct from list items (leading `+`, accent-tinted on hover). It is **not** a `CommandItem` — it is never filtered out by the search query, never keyboard-selected as a PR, and never scrolls away.

```
[⎇ #125 Fix auth bug ▾]
┌───────────────────────────────┐
│  + New pull request           │ ← pinned, accent, never filtered
├───────────────────────────────┤
│ 🔍  Search pull requests...   │
├─── Open ──── Merged ── Draft ─┤
│ ✓ #125  Fix auth bug          │
│   #124  Add dark mode         │
│   #122  Refactor API client   │
│ ───────────────────────────── │
│   #121  Update dependencies   │
└───────────────────────────────┘
```

### Step 0 — Inline branch-pairing gate (in popover)

Clicking `+ New pull request` **replaces the popover body** with a branch-pairing step. It does not immediately route anywhere. Rationale: branch pairing is a selection gesture; inline mode-swap is already the house idiom (`RefSelector` swaps branch/tag modes via `ToggleGroup`). A user who clicks `+`, sees "nothing to compare," and backs out pays zero navigation cost.

Two `<BranchPicker>` selectors (base ← head). On every valid pair a lightweight compare probe fires (`GET /compare/base...head`). Outcomes:

- **Ahead-by ≥ 1:** shows a one-line summary and enables `Continue →`.
- **Ahead-by 0:** "Nothing to compare — head is up to date with base." `Continue` disabled.
- **Head already has an open PR:** inline warning with a jump link to the existing PR. Creation not hard-blocked but default action becomes "open the existing one."

`Continue →` closes the popover and routes to `/[owner]/[repo]/pulls/new?base=…&head=…`.

```
┌───────────────────────────────┐
│ ←  New pull request           │
├───────────────────────────────┤
│  base  [⎇ main          ▾]    │
│  head  [⎇ feat/auth-fix ▾]    │
├───────────────────────────────┤
│  ✓ 12 commits · 8 files       │
│    +340  −52  · mergeable     │
│                               │
│            [ Continue → ]     │
└───────────────────────────────┘
```

Dead-end and duplicate-PR variants:

```
│  ⓘ Nothing to compare —       │      │  ⚠ feat/auth-fix already has  │
│    head is up to date.         │      │    an open PR:                │
│            [ Continue → ]  ✗  │      │    → #124 Add dark mode [Open] │
│                               │      │       [ Continue anyway ]      │
```

### The creation route — `/[owner]/[repo]/pulls/new`

A dedicated full route parameterised by query string (`?base=main&head=feat/x`). The `?base`/`?head` params make the route reentrant — the popover pre-fills them, but the URL can also be constructed directly (e.g., a future "Create PR" button on the code view passes `?ref` as head).

The route is laid out as a **"pre-PR dashboard"** — an editable echo of the dashboard the author is about to publish. It reuses the full-width column and the Zone A identity strip in editable mode. The comparison summary band stands in for Zones C/D/E. Zones B/F/G/H/I have no pre-creation analogue and are absent.

```
┌──────────────────────────────────────────────────────────────┐
│  New pull request                              [Cancel]       │
├──────────────────────────────────────────────────────────────┤
│  base [⎇ main ▾]  ←  head [⎇ feat/auth-fix ▾]               │ ← editable, re-probes live
│                                                              │
│  ┌── Comparison ─────────────────────────────────────────┐  │
│  │ ✓ Able to merge · 12 commits · 8 files · +340 −52     │  │
│  │ ▸ Preview diff                                         │  │ ← collapsed
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Title                                                       │
│  [ Auth fix___________________________________________ ]     │ ← auto-seeded
│                                                              │
│  Description                  [ Write | Preview ]            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ## Summary                                            │  │ ← PR template pre-loaded
│  │ ## Testing                                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ── Metadata (mirrors Zone A) ──────────────────────────    │
│  Reviewers  [+ add]      Assignees  [+ add]                  │
│  Labels     [+ add]      Milestone  [+ none]                 │
│  Project    [+ none]     Linked issues [+ add]               │
│                                                              │
│  ── Publish ─────────────────────────────────────────────   │
│  ( • Ready for review )  ( Create as draft )                 │
│                                                              │
│                       [ Cancel ]  [ Create pull request ]    │
└──────────────────────────────────────────────────────────────┘
```

"Preview diff" expansion reuses the same diff component as `/[number]/diff`, mounted read-only and collapsed by default:

```
│  ▾ Preview diff                                              │
│  ┌──────────────────┬─────────────────────────────────────┐ │
│  │ src/auth.ts   +88│  - const t = getToken()             │ │
│  │ src/login.ts  +40│  + const t = await getToken()       │ │
│  │ api/client.ts −18│  + if (!t) throw new AuthError      │ │
│  │ test/auth…    +52│  …                                   │ │
│  └──────────────────┴─────────────────────────────────────┘ │
```

### Form field order and rationale

Order is by commitment cost and editing frequency. Irreversible/expensive-to-change things first; set-and-forget metadata follows; publish decision last, nearest the submit button.

1. **Comparison header** (locked but editable — editing re-probes live)
2. **Comparison summary band** — commits/files/±lines, mergeability, collapsible diff preview
3. **Title** — auto-seeded from head's single commit message or humanised branch name
4. **Description** — markdown editor with write/preview toggle; PR template pre-loaded if present
5. **Metadata strip** — Reviewers, Assignees, Labels, Milestone, Project, Linked issues
6. **Draft toggle** — `Ready for review` / `Create as draft` segmented control
7. **Submit** — label bound to toggle: "Create pull request" / "Create draft pull request"

**Merge method is not collected at creation.** It is a Zone B (Verdict) decision made at merge time, often by a different person. Collecting it at creation would be premature state that branch-protection rules may override anyway.

**Why a single form, not a wizard:** after the branch-pair gate, every remaining field is independent and non-sequential. Wizardising independent fields adds clicks and hides the whole from the author.

### Integration with existing components

**`RefSelector` → `<BranchPicker>` core**

Extract a headless `<BranchPicker>` from `RefSelector`: the popover + cmdk list + `fetchBranches` loading + search. Both consumers wrap it:
- `RefSelector` = `<BranchPicker onSelect={routeWithRef} />` — unchanged, branches and tags.
- Creation = two `<BranchPicker onSelect={setBase/setHead} branchesOnly />` instances — branches only (no PRs from tags), `ToggleGroup` omitted, `defaultBranch` auto-selects base.

**Metadata strip ⇄ Zone A**

The creation form's metadata strip and Zone A are **the same component in two modes**: `editable` (creation) and `display-with-inline-edit` (dashboard). Same field order, same chip rendering, same pickers. What the author arranges during creation is pixel-identical to what Zone A shows a second later.

**Landing after creation**

1. **Route-replace** (not push) to the new PR's dashboard `/[owner]/[repo]/pulls/[newNumber]`. Back returns to the launch origin, not the stale `/new` form.
2. **Optimistically insert** the new PR at the top of the switcher's Open/Draft tab and mark it current, before the server list refetches.
3. Dashboard mounts in normal state — Zone B shows "Checks pending / no reviews yet." No special "just created" chrome.

### Edge cases

| Case | Behaviour |
|---|---|
| Nothing to compare | Caught at popover gate. Continue disabled. User never reaches `/new`. |
| Head already has an open PR | Caught at gate. Inline warning with jump link. Creation not blocked but default action is "open existing." |
| PR template present | Detected during route transition. Single template → pre-loaded into description. Multiple → template chooser chips above empty editor. Template load never overwrites text already typed. |
| Cross-fork PR | In scope. A repo/fork selector adjacent to the base picker switches scope. Default is same-repo; fork scope is a disclosed extension. |
| Branch doesn't exist yet | Out of scope. `<BranchPicker>` list is authoritative — if not in the list, not selectable. |
| Permission / protected base | Gate allows reaching the form. Server rejection surfaced inline on submit rather than guessing at branch protection client-side. |

### Actions during creation

| Action | Behaviour |
|---|---|
| **Cancel** | Router back. Confirmation prompt only if form is dirty beyond auto-seeded defaults. |
| **Edit branch pair** | Inline in comparison header; re-probes and updates summary/diff live. No "back to step 0." |
| **Preview description** | Write/Preview toggle on description editor. |
| **Preview diff** | Collapsible disclosure in comparison band. |
| **Toggle draft** | Segmented control; rebinds submit button label. |
| **Submit** | On success → route-replace to new PR dashboard + optimistic switcher insert. On rejection → inline error, form state preserved. |

**Autosave:** branch pair is the URL (`?base&head`) — persistent across refresh and shareable. Title/description/metadata are autosaved to local draft state keyed by `owner/repo/base/head` and restored on refresh. Local draft clears on successful create or explicit Cancel-with-discard. Named distinctly from "Create as draft" (the GitHub-level PR state) in all UI copy.

---

## Live dashboard state changes

Every mutating action feeds back into the dashboard without a page reload:

| Action | What updates on the dashboard |
|---|---|
| Merge | B → MERGED; rail badge; delete-branch affordance surfaces; C/D/H go historical; I gains event |
| Close / Reopen | B state; primary cluster swaps |
| Convert to draft / Mark ready | B → DRAFT / recomputes Verdict + required gates |
| Enable / disable auto-merge | B notable toggles "Auto-merge armed"; rail reflects |
| Submit approve review | C reviewer row flips; B "awaiting review" blocker may clear; Verdict may flip READY |
| Submit request-changes review | C reviewer row; B gains "Changes requested" blocker |
| Resolve last thread | H count → 0; B "unresolved threads" blocker clears; Verdict may flip READY |
| Request / re-request reviewer | C gains pending row / resets wait-time; B may add/remove "awaiting review" blocker |
| Re-run check | D row → running; B re-evaluates that gate; F chips backed by check go stale → refresh |
| Update branch from base | "Behind base" notable clears; D checks restart |
| Commit a suggestion / push | A commit count +1; D re-runs; E delta recomputes; F refreshes |
| Set labels / assignees | A chips/avatars update optimistically |
| Edit title | A title + Verdict Rail title update live |
| Dismiss security alert | F chip → muted; B may clear a policy/security blocker |
| Lock conversation | G composer disabled; lock banner appears |
