"use client";

import { fetchPullRequestPatches, type PatchFile } from "@/lib/github/pulls";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

interface DiffViewProps {
  owner: string;
  repo: string;
  prNumber: number;
}

function DiffLine({ line }: { line: string }) {
  if (line.startsWith("@@")) {
    return (
      <div className="bg-muted px-3 py-0.5 font-mono text-xs text-muted-foreground">
        {line}
      </div>
    );
  }
  if (line.startsWith("+")) {
    return (
      <div className="bg-green-50 px-3 py-0 font-mono text-xs text-green-800 dark:bg-green-950/40 dark:text-green-300">
        {line}
      </div>
    );
  }
  if (line.startsWith("-")) {
    return (
      <div className="bg-red-50 px-3 py-0 font-mono text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
        {line}
      </div>
    );
  }
  return (
    <div className="px-3 py-0 font-mono text-xs text-foreground">
      {line}
    </div>
  );
}

function FilePatch({ file }: { file: PatchFile }) {
  const lines = file.patch ? file.patch.split("\n") : [];
  return (
    <details open className="rounded-lg border bg-card">
      <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3 text-sm font-medium marker:hidden">
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.filename}</span>
        <span className="shrink-0 text-xs text-green-600">+{file.additions}</span>
        <span className="shrink-0 text-xs text-red-500">−{file.deletions}</span>
      </summary>
      {lines.length > 0 && (
        <div className="overflow-x-auto border-t">
          {lines.map((line, i) => (
            <DiffLine key={i} line={line} />
          ))}
        </div>
      )}
      {file.patch === null && (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Binary file — no diff available.
        </p>
      )}
    </details>
  );
}

export function DiffView({ owner, repo, prNumber }: DiffViewProps) {
  const { data: files = [], isLoading } = useSWR(
    [owner, repo, prNumber, "patches"],
    ([o, r, n]) => fetchPullRequestPatches(o, r, n),
  );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6 [scrollbar-gutter:stable]">
      <div>
        <Link
          href={`/${owner}/${repo}/pulls/${prNumber}`}
          className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to PR #{prNumber}
        </Link>
      </div>

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

      {!isLoading && files.map((f) => (
        <FilePatch key={f.filename} file={f} />
      ))}
    </div>
  );
}
