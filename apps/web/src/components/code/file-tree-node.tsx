"use client";

import { cn } from "@/lib/utils";
import type { TreeEntry } from "@/lib/github/types";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import Link from "next/link";

interface FileTreeNodeProps {
  entry: TreeEntry;
  depth: number;
  isActive: boolean;
  isExpanded: boolean;
  basePath: string;
  onToggle?: () => void;
}

export function FileTreeNode({
  entry,
  depth,
  isActive,
  isExpanded,
  basePath,
  onToggle,
}: FileTreeNodeProps) {
  const indent = depth * 12;

  if (entry.type === "dir") {
    return (
      <button
        onClick={onToggle}
        style={{ paddingLeft: `${8 + indent}px` }}
        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm transition-colors hover:bg-muted/60"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            isExpanded && "rotate-90",
          )}
        />
        {isExpanded ? (
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{entry.name}</span>
      </button>
    );
  }

  return (
    <Link
      href={`${basePath}/${entry.path}`}
      style={{ paddingLeft: `${8 + 14 + indent}px` }}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm transition-colors hover:bg-muted/60",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
      )}
    >
      <File className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{entry.name}</span>
    </Link>
  );
}
