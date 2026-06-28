"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fetchPullRequest } from "@/lib/github/pulls";
import { ArrowLeft, GitPullRequest } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";

// Owner-level slugs that are never repo names — mirrors ref-selector.tsx.
const RESERVED = new Set([
  "review", "pulls", "assigned", "mentions",
  "checks", "repositories", "projects", "teams",
]);

// Header element for the PR detail view: a back button to the pulls list plus
// the current PR identity. Replaces the PR switcher — choosing a different PR
// is now done from the Pulls list view. Reuses PullsView's SWR cache key
// (`[owner, repo, number, "pr"]`) so the title costs no extra request.
export function PRDetailBar() {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const first = params.rest?.[0];
  const repo = first && !RESERVED.has(first) ? first : undefined;
  const prNumberStr = params.rest?.[2];
  const number =
    prNumberStr && /^\d+$/.test(prNumberStr)
      ? parseInt(prNumberStr, 10)
      : undefined;

  const { data: pr } = useSWR(
    owner && repo && number ? [owner, repo, number, "pr"] : null,
    ([o, r, n]: [string, string, number]) => fetchPullRequest(o, r, n),
  );

  if (!repo || number === undefined) return null;

  const label = pr ? `#${pr.number} ${pr.title}` : `#${number}`;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Back to pull requests"
        render={<Link href={`/${owner}/${repo}/pulls`} />}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <Separator
        orientation="vertical"
        className="mx-1 data-[orientation=vertical]:h-4"
      />
      <span className="flex items-center gap-2 text-sm font-medium">
        <GitPullRequest className="size-4 shrink-0" />
        <span className="max-w-80 truncate">{label}</span>
      </span>
    </>
  );
}
