"use client";

import { Button } from "@/components/ui/button";
import type { FileCommit } from "@/lib/github/types";
import { Download, MoreHorizontal } from "lucide-react";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  const mo = Math.floor(d / 30);
  const y = Math.floor(d / 365);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  if (mo < 12) return `${mo}mo ago`;
  return `${y}y ago`;
}

interface FileHeaderProps {
  path: string;
  commit: FileCommit | null;
  downloadUrl: string | null;
}

export function FileHeader({ path, commit, downloadUrl }: FileHeaderProps) {
  const segments = path.split("/");

  const filename = segments[segments.length - 1];

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-2">
      {/* Filename + provenance */}
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className="font-mono font-medium text-foreground">{filename}</span>
        {commit && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="select-none opacity-40">·</span>
            <span className="font-mono">{commit.shortSha}</span>
            <span className="select-none opacity-40">·</span>
            <span>{relativeTime(commit.date)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {downloadUrl && (
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<a href={downloadUrl} download />}
            aria-label="Download file"
          >
            <Download className="size-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="More actions">
          <MoreHorizontal className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
