"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ExternalLink,
  Globe,
  Grid2x2,
  List,
  Lock,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchPackages } from "@/lib/github/packages";
import { formatTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { PackageDetail, PackageType } from "@/lib/github/types";

// ─── Shared atoms ────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<PackageType, string> = {
  npm: "npm",
  maven: "Maven",
  rubygems: "RubyGems",
  docker: "Docker",
  nuget: "NuGet",
  container: "Container",
};

const TYPE_COLOR: Record<PackageType, string> = {
  npm: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  maven: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  rubygems: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  docker: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  nuget: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  container: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

function TypeBadge({ type }: { type: PackageType }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        TYPE_COLOR[type],
      )}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility: "public" | "private" }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground" />
          }
        >
          {visibility === "public" ? (
            <Globe className="size-3" />
          ) : (
            <Lock className="size-3" />
          )}
          {visibility}
        </TooltipTrigger>
        <TooltipContent>
          {visibility === "public" ? "Publicly visible" : "Private package"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ExternalLinkButton({ href }: { href: string }) {
  if (!href) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            />
          }
        >
          <ExternalLink className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>View on GitHub</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── List item ───────────────────────────────────────────────────────────────

function PackageListItem({ pkg }: { pkg: PackageDetail }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{pkg.name}</span>
          <TypeBadge type={pkg.packageType} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {pkg.versionCount} {pkg.versionCount === 1 ? "version" : "versions"} ·{" "}
          updated {formatTimeAgo(pkg.updatedAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <VisibilityBadge visibility={pkg.visibility} />
        <ExternalLinkButton href={pkg.htmlUrl} />
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function PackageCard({ pkg }: { pkg: PackageDetail }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Package className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{pkg.name}</span>
          </div>
          <ExternalLinkButton href={pkg.htmlUrl} />
        </div>
        <TypeBadge type={pkg.packageType} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <span className="text-xs text-muted-foreground">
          {pkg.versionCount} {pkg.versionCount === 1 ? "version" : "versions"}
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(pkg.updatedAt)}
        </span>
        <span className="ml-auto">
          <VisibilityBadge visibility={pkg.visibility} />
        </span>
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
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="size-4" />
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
            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded" />
          </div>
          <div className="flex items-center gap-2 border-t pt-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Type filter ─────────────────────────────────────────────────────────────

function applyTypeFilter(
  packages: PackageDetail[],
  type: PackageType | "all",
): PackageDetail[] {
  if (type === "all") return packages;
  return packages.filter((p) => p.packageType === type);
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function PackagesView({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [typeFilter, setTypeFilter] = useState<PackageType | "all">("all");

  const { data: packages, isLoading, error } = useSWR(
    ["packages", owner, repo],
    () => fetchPackages(owner, repo),
  );

  const presentTypes = packages
    ? ([...new Set(packages.map((p) => p.packageType))] as PackageType[])
    : [];
  const showTypeFilter = presentTypes.length > 1;

  const filtered = packages ? applyTypeFilter(packages, typeFilter) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading packages…"
              : `${filtered.length} ${filtered.length === 1 ? "package" : "packages"}`}
          </p>
          {showTypeFilter && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTypeFilter("all")}
                className={cn(
                  "rounded px-2 py-0.5 text-xs transition-colors",
                  typeFilter === "all"
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {presentTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs transition-colors",
                    typeFilter === type
                      ? "bg-secondary text-secondary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          )}
        </div>

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

      {error ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Failed to load packages.
        </div>
      ) : isLoading ? (
        viewMode === "list" ? (
          <ListSkeleton />
        ) : (
          <CardSkeleton />
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No packages found for this repository.
        </div>
      ) : viewMode === "list" ? (
        <div className="divide-y rounded-lg border">
          {filtered.map((pkg) => (
            <PackageListItem key={pkg.id} pkg={pkg} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
