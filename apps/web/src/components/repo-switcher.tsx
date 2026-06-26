"use client";

import { ChevronsUpDown, FolderGit2 } from "lucide-react";
import { NavPicker, NavPickerGroup, NavPickerItem } from "@/components/nav-picker";
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
        active ? "bg-muted" : "bg-muted/75 hover:bg-muted",
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
  return (
    <NavPicker placeholder="Search repositories…" emptyText="No repository found.">
      <NavPickerGroup>
        <NavPickerItem
          value="All repositories"
          href={`/${owner}`}
          active={!activeRepo}
          onNavigate={onNavigate}
        >
          All repositories
        </NavPickerItem>
        {repos.map((repo) => (
          <NavPickerItem
            key={repo.name}
            value={repo.name}
            href={`/${owner}/${repo.name}`}
            active={activeRepo === repo.name}
            onNavigate={onNavigate}
          >
            {repo.name}
          </NavPickerItem>
        ))}
      </NavPickerGroup>
    </NavPicker>
  );
}
