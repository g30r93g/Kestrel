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
