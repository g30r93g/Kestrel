"use client";

import useSWR from "swr";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import {
  Code,
  Download,
  ExternalLink,
  FileArchive,
  Package,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { ChevronToggle } from "@/components/ui/chevron-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchTagsAndReleases } from "@/lib/github/tags-and-releases";
import { formatTimeAgo } from "@/lib/time";
import type { ReleaseAsset, TagsAndReleasesItem } from "@/lib/github/types";

// ─── Badges ──────────────────────────────────────────────────────────────────

function LatestBadge() {
  return (
    <span className="rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground">
      latest
    </span>
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

// ─── Atoms ───────────────────────────────────────────────────────────────────

function TaggerAvatar({ item }: { item: TagsAndReleasesItem }) {
  const displayName = item.tagger.name || item.tagger.login || "?";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="cursor-default" />}>
          <Avatar size="sm">
            <AvatarImage src={item.tagger.avatarUrl} alt={displayName} />
            <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>{displayName}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DownloadButtons({ item }: { item: TagsAndReleasesItem }) {
  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={item.zipballUrl}
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
                href={item.tarballUrl}
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

// ─── Row header (shared layout) ──────────────────────────────────────────────

function RowContent({ item }: { item: TagsAndReleasesItem }) {
  const showReleaseTitle =
    item.release?.title && item.release.title !== item.name;

  return (
    <>
      <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{item.name}</span>
          {item.release?.isLatest && <LatestBadge />}
          {item.release?.isPrerelease && <PrereleaseBadge />}
          {item.release?.isDraft && <DraftBadge />}
        </div>
        {showReleaseTitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.release!.title}
          </p>
        )}
        {!item.release && item.message && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.message}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <TaggerAvatar item={item} />
          {item.tagger.date && <span>{formatTimeAgo(item.tagger.date)}</span>}
          <span className="font-mono">{item.sha.slice(0, 7)}</span>
        </div>
      </div>
    </>
  );
}

// ─── Release panel content ───────────────────────────────────────────────────

function AssetRow({ asset }: { asset: ReleaseAsset }) {
  return (
    <a
      href={asset.downloadUrl}
      className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
    >
      <Package className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono">{asset.name}</span>
      {asset.downloadCount > 0 && (
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <Download className="size-3" />
          {asset.downloadCount.toLocaleString()}
        </span>
      )}
    </a>
  );
}

function ReleasePanel({
  release,
}: {
  release: NonNullable<TagsAndReleasesItem["release"]>;
}) {
  const body = release.body.trim();

  return (
    <div className="min-w-0 overflow-hidden border-t bg-muted/50 px-4 pb-4 pl-11 pt-4">
      {!body && release.assets.length === 0 ? (
        <p className="text-xs text-muted-foreground">No release notes.</p>
      ) : (
        <div className="grid min-w-0 grid-cols-[5fr_auto_2fr] gap-4">
          <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none break-words [&_a]:break-all [&_pre]:overflow-x-auto [&_pre]:whitespace-pre">
            {body ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">No release notes.</p>
            )}
          </div>

          <Separator orientation="vertical" />

          {release.assets.length > 0 ? (
            <div className="space-y-0.5">
              <p className="px-2 text-xs font-medium text-muted-foreground">
                Assets
              </p>
              {release.assets.map((asset) => (
                <AssetRow key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  );
}

// ─── List items ───────────────────────────────────────────────────────────────

function CodeButton({ item, owner, repo }: { item: TagsAndReleasesItem; owner: string; repo: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={`/${owner}/${repo}/code?ref=${encodeURIComponent(item.name)}&refkind=tag`}
              className="flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            />
          }
        >
          <Code className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>Browse code at this tag</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ReleasedTagRow({ item, owner, repo }: { item: TagsAndReleasesItem; owner: string; repo: string }) {
  const [open, setOpen] = useState(false);

  return (
    <AccordionPrimitive.Item value={item.name} className="group/item" onOpenChange={setOpen}>
      <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
        <RowContent item={item} />

        <div className="flex shrink-0 items-center gap-1">
          <CodeButton item={item} owner={owner} repo={repo} />
          <DownloadButtons item={item} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    href={item.release!.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  />
                }
              >
                <ExternalLink className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>View release on GitHub</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <AccordionPrimitive.Header render={<span className="contents" />}>
            <AccordionPrimitive.Trigger className="flex items-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronToggle open={open} className="size-3.5" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
        </div>
      </div>

      <AccordionPrimitive.Panel className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
        <div className="h-(--accordion-panel-height) data-starting-style:h-0 data-ending-style:h-0">
          <ReleasePanel release={item.release!} />
        </div>
      </AccordionPrimitive.Panel>
    </AccordionPrimitive.Item>
  );
}

function BareTagRow({ item, owner, repo }: { item: TagsAndReleasesItem; owner: string; repo: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <RowContent item={item} />
      <div className="flex shrink-0 items-center gap-1">
        <CodeButton item={item} owner={owner} repo={repo} />
        <DownloadButtons item={item} />
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="divide-y rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="mt-0.5 size-4 rounded" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
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

// ─── Main view ───────────────────────────────────────────────────────────────

export function TagsAndReleasesView({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const { data: items, isLoading } = useSWR(
    ["tags-and-releases", owner, repo],
    () => fetchTagsAndReleases(owner, repo),
  );

  const count = items?.length ?? 0;
  const withRelease = items?.filter((i) => i.release).length ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isLoading
          ? "Loading tags & releases…"
          : `${count} tag${count !== 1 ? "s" : ""}${withRelease > 0 ? ` · ${withRelease} release${withRelease !== 1 ? "s" : ""}` : ""}`}
      </p>

      {isLoading ? (
        <ListSkeleton />
      ) : !items || items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tags yet.
        </div>
      ) : (
        <AccordionPrimitive.Root
          multiple
          className="min-w-0 divide-y overflow-hidden rounded-lg border"
        >
          {items.map((item) =>
            item.release ? (
              <ReleasedTagRow key={item.name} item={item} owner={owner} repo={repo} />
            ) : (
              // BareTagRow is not an AccordionItem, so wrap in a div that
              // carries the same border-b behaviour as AccordionItem does.
              <div key={item.name}>
                <BareTagRow item={item} owner={owner} repo={repo} />
              </div>
            ),
          )}
        </AccordionPrimitive.Root>
      )}
    </div>
  );
}
