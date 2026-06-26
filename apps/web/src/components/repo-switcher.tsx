"use client";

import { ChevronsUpDown, FolderGit2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Repo } from "@/lib/github";

// The pill at the top of the sidebar. Acts as a toggle for the repo list;
// shows an active state while the list is open.
export function RepoSwitcher({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={active}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-muted ring-1 ring-border" : "bg-muted/75 hover:bg-muted",
      )}
    >
      <FolderGit2 className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

// Inline searchable repo list that replaces the nav tree while picking.
export function RepoList({
  owner,
  repos,
  activeRepo,
  onNavigate,
}: {
  owner: string;
  repos: Repo[];
  activeRepo?: string;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const go = (href: string) => {
    onNavigate();
    router.push(href);
  };

  return (
    <Command className="bg-transparent">
      <CommandInput placeholder="Search repositories…" autoFocus />
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
  );
}
