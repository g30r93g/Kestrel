"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IssuesList } from "./issues-list";
import { IssueDetail } from "./issue-detail";

export function IssuesView({ owner, repo }: { owner: string; repo: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const issueParam = searchParams.get("issue");
  const selectedIssueNumber = issueParam ? parseInt(issueParam, 10) : null;

  const handleSelect = useCallback(
    (n: number) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("issue", String(n));
      router.push(`?${next.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <aside className="flex w-80 shrink-0 flex-col border-r overflow-hidden">
        <IssuesList
          owner={owner}
          repo={repo}
          selectedIssueNumber={selectedIssueNumber}
          onSelect={handleSelect}
        />
      </aside>
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {selectedIssueNumber != null ? (
          <IssueDetail
            owner={owner}
            repo={repo}
            issueNumber={selectedIssueNumber}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="text-2xl">◎</span>
            <span>Select an issue to view it here</span>
          </div>
        )}
      </div>
    </div>
  );
}
