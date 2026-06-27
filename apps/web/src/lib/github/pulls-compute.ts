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
  const BLOCKING_CONCLUSIONS = new Set<string>(["failure", "timed_out", "action_required"]);
  const failingRequired = checks.filter(
    (c) => c.isRequired && c.conclusion !== null && BLOCKING_CONCLUSIONS.has(c.conclusion),
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
