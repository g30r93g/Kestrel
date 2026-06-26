"use client";

import { NavPicker, NavPickerGroup, NavPickerItem } from "@/components/nav-picker";
import { usePinnedRepos } from "@/hooks/use-pinned-repos";
import type { Repo } from "@/lib/github";
import { cn } from "@/lib/utils";
import { Button } from "@base-ui/react";
import { ChevronsUpDown, FolderGit2, Pin } from "lucide-react";

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
    <Button
      type="button"
      aria-expanded={active}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors text-sidebar-accent-foreground",
        active ? "bg-muted" : "bg-muted/75 hover:bg-muted",
      )}
    >
      <FolderGit2 className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </Button>
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
  const { isPinned, toggle } = usePinnedRepos();
  const pinKey = (name: string) => `${owner}/${name}`;

  const pinned = repos.filter((r) => isPinned(pinKey(r.name)));
  const others = repos.filter((r) => !isPinned(pinKey(r.name)));

  const repoItem = (repo: Repo, index: number) => {
    const pinnedState = isPinned(pinKey(repo.name));
    return (
      <NavPickerItem
        key={repo.name}
        index={index}
        value={repo.name}
        href={`/${owner}/${repo.name}`}
        active={activeRepo === repo.name}
        onNavigate={onNavigate}
        action={
          <button
            type="button"
            aria-label={pinnedState ? "Unpin repository" : "Pin repository"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(pinKey(repo.name));
            }}
            className={cn(
              "rounded p-0.5 text-muted-foreground transition-opacity hover:text-foreground",
              pinnedState
                ? "opacity-100"
                : "opacity-0 group-hover/nav-item:opacity-100 focus-visible:opacity-100",
            )}
          >
            <Pin className={cn("size-3.5", pinnedState && "fill-current")} />
          </button>
        }
      >
        {repo.name}
      </NavPickerItem>
    );
  };

  return (
    <NavPicker placeholder="Search repositories…" emptyText="No repository found.">
      <NavPickerGroup>
        <NavPickerItem
          index={0}
          value="All repositories"
          href={`/${owner}`}
          active={!activeRepo}
          onNavigate={onNavigate}
        >
          All repositories
        </NavPickerItem>
      </NavPickerGroup>

      {pinned.length > 0 && (
        <NavPickerGroup heading="Pinned">
          {pinned.map((repo, i) => repoItem(repo, i + 1))}
        </NavPickerGroup>
      )}

      {others.length > 0 && (
        <NavPickerGroup heading={pinned.length > 0 ? "Repositories" : undefined}>
          {others.map((repo, i) => repoItem(repo, pinned.length + i + 1))}
        </NavPickerGroup>
      )}
    </NavPicker>
  );
}
