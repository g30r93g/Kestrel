"use client";

import { useState } from "react";
import { ChevronsUpDown, FolderGit2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
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
import type { Repo } from "@/lib/github";

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

export function RepoSwitcher({ owner, repos }: { owner: string; repos: Repo[] }) {
  const router = useRouter();
  const params = useParams<{ rest?: string[] }>();
  const [open, setOpen] = useState(false);

  const first = params.rest?.[0];
  const activeRepo = first && !RESERVED.has(first) ? first : undefined;
  const label = activeRepo ?? "All repositories";

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="gap-2 font-medium" />}>
        <FolderGit2 className="size-4" />
        {label}
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search repositories…" />
          <CommandList>
            <CommandEmpty>No repository found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="All repositories"
                data-checked={!activeRepo ? "true" : undefined}
                onSelect={() => go(`/${owner}`)}
              >
                All repositories
              </CommandItem>
              {repos.map((repo) => (
                <CommandItem
                  key={repo.name}
                  value={repo.name}
                  data-checked={activeRepo === repo.name ? "true" : undefined}
                  onSelect={() => go(`/${owner}/${repo.name}`)}
                >
                  {repo.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
