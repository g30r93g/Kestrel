"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  FileArchive,
  Grid2x2,
  List,
  Package,
  Rocket,
  Tag,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchTagDetails } from "@/lib/github/tags";
import { formatTimeAgo } from "@/lib/time";
import type { TagDetail } from "@/lib/github/types";

// ─── Atoms ───────────────────────────────────────────────────────────────────

function TaggerAvatar({ tag }: { tag: TagDetail }) {
  const displayName = tag.tagger.name || tag.tagger.login || "?";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="cursor-default" />}>
          <Avatar size="sm">
            <AvatarImage src={tag.tagger.avatarUrl} alt={displayName} />
            <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>{displayName}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ReleaseBadge({
  release,
}: {
  release: NonNullable<TagDetail["release"]>;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href={release.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            />
          }
        >
          <Rocket className="size-3.5" />
          {release.name}
        </TooltipTrigger>
        <TooltipContent>View release</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PrereleaseBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      pre-release
    </span>
  );
}

function DraftBadge() {
  return (
    <span className="rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground">
      draft
    </span>
  );
}

function DownloadButtons({ tag }: { tag: TagDetail }) {
  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={tag.zipballUrl}
                className="flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            }
          >
            <FileArchive className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Download ZIP</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={tag.tarballUrl}
                className="flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            }
          >
            <Package className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Download tarball</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ─── List item ───────────────────────────────────────────────────────────────

function TagListItem({ tag }: { tag: TagDetail }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{tag.name}</span>
          {tag.release && <ReleaseBadge release={tag.release} />}
          {tag.release?.isPrerelease && <PrereleaseBadge />}
          {tag.release?.isDraft && <DraftBadge />}
        </div>
        {tag.message && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {tag.message}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <TaggerAvatar tag={tag} />
          {tag.tagger.date && (
            <span>{formatTimeAgo(tag.tagger.date)}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <DownloadButtons tag={tag} />
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function TagCard({ tag }: { tag: TagDetail }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Tag className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{tag.name}</span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            {tag.release?.isPrerelease && <PrereleaseBadge />}
            {tag.release?.isDraft && <DraftBadge />}
          </div>
        </div>
        {tag.message && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {tag.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TaggerAvatar tag={tag} />
        {tag.tagger.date && <span>{formatTimeAgo(tag.tagger.date)}</span>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {tag.release ? (
          <ReleaseBadge release={tag.release} />
        ) : (
          <span />
        )}
        <DownloadButtons tag={tag} />
      </div>
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="divide-y rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="mt-0.5 size-4 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="size-6 rounded" />
            <Skeleton className="size-6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="flex justify-between border-t pt-3">
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-1">
              <Skeleton className="size-6 rounded" />
              <Skeleton className="size-6 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function TagsView({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

  const { data: tags, isLoading } = useSWR(
    ["tag-details", owner, repo],
    () => fetchTagDetails(owner, repo),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading tags…"
            : `${tags?.length ?? 0} tag${(tags?.length ?? 0) !== 1 ? "s" : ""}`}
        </p>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
          >
            <List />
          </Button>
          <Button
            variant={viewMode === "card" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("card")}
            aria-label="Card view"
            aria-pressed={viewMode === "card"}
          >
            <Grid2x2 />
          </Button>
        </div>
      </div>

      {isLoading ? (
        viewMode === "list" ? (
          <ListSkeleton />
        ) : (
          <CardSkeleton />
        )
      ) : !tags || tags.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tags yet.
        </div>
      ) : viewMode === "list" ? (
        <div className="divide-y rounded-lg border">
          {tags.map((tag) => (
            <TagListItem key={tag.name} tag={tag} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <TagCard key={tag.name} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
}
