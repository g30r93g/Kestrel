"use client";

import { Check, ChevronsUpDown, FolderGit2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Repo } from "@/lib/github";

export function RepoSwitcher({ owner, repos }: { owner: string; repos: Repo[] }) {
  const router = useRouter();
  const params = useParams<{ rest?: string[] }>();
  const first = params.rest?.[0];
  const reserved = new Set(["review", "pulls", "assigned", "mentions", "checks", "repositories", "projects", "teams"]);
  const activeRepo = first && !reserved.has(first) ? first : undefined;
  const label = activeRepo ?? "All repositories";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2 font-medium" />}>
        <FolderGit2 className="size-4" />
        {label}
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuItem onClick={() => router.push(`/${owner}`)}>
          {!activeRepo && <Check className="size-4" />}
          All repositories
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {repos.map((repo) => (
          <DropdownMenuItem key={repo.name} onClick={() => router.push(`/${owner}/${repo.name}`)}>
            {activeRepo === repo.name && <Check className="size-4" />}
            {repo.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
