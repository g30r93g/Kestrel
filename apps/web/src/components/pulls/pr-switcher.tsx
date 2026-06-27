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
import { useState } from "react";
import useSWR from "swr";

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

  const { data: prs = [] } = useSWR(
    owner && repo ? [owner, repo, "prs"] : null,
    ([o, r]: [string, string]) => fetchPullRequests(o, r),
  );

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
