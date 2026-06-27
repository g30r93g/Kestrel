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
        pr={pr ?? null}
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
