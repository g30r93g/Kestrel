"use client";

import { useState } from "react";
import { ChevronsUpDown, FolderGit2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
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
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md bg-muted/75 px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted data-[popup-open]:bg-muted"
          />
        }
      >
        <FolderGit2 className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
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
