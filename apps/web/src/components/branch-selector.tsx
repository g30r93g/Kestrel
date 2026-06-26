"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDown, GitBranch } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { fetchBranches } from "@/lib/github/branches";

// Owner-level slugs that aren't repos, mirrored from the nav resolver.
const RESERVED = new Set([
  "review",
  "pulls",
  "assigned",
  "mentions",
  "checks",
  "repositories",
  "projects",
  "teams",
]);

export function BranchSelector() {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const owner = params.owner;
  const first = params.rest?.[0];
  const repo = first && !RESERVED.has(first) ? first : undefined;

  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = useState("");

  useEffect(() => {
    if (!owner || !repo) return;
    let cancelled = false;
    fetchBranches(owner, repo).then((res) => {
      if (cancelled) return;
      setBranches(res.branches);
      setDefaultBranch(res.defaultBranch);
    });
    return () => {
      cancelled = true;
    };
  }, [owner, repo]);

  // Only meaningful inside a repo.
  if (!repo) return null;

  const currentRef = searchParams.get("ref") ?? defaultBranch;

  const select = (branch: string) => {
    setOpen(false);
    const next = new URLSearchParams(searchParams.toString());
    if (branch === defaultBranch) next.delete("ref");
    else next.set("ref", branch);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="sm" className="gap-2 font-medium" />}>
          <GitBranch className="size-4 shrink-0" />
          <span className="max-w-40 truncate">{currentRef || "Branch"}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Search branches…" />
            <CommandList>
              <CommandEmpty>No branch found.</CommandEmpty>
              <CommandGroup>
                {branches.map((branch) => (
                  <CommandItem
                    key={branch}
                    value={branch}
                    data-checked={branch === currentRef ? "true" : undefined}
                    onSelect={() => select(branch)}
                  >
                    {branch}
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
