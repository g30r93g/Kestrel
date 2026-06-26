"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preload } from "swr";
import useSWRImmutable from "swr/immutable";
import { fetchTreeEntries } from "@/lib/github/tree";
import { FileTreeNode } from "./file-tree-node";

// Module-level map persists expansion state across client-side navigations.
const expansionCache = new Map<string, Set<string>>();

// Shared fetcher: key-based so preload and useSWRImmutable share the same
// cache slot. gitRef stored as null (not undefined) for stable serialisation.
type TreeKey = readonly ["tree", string, string, string, string | null];
const treeFetcher = ([, owner, repo, path, ref]: TreeKey) =>
  fetchTreeEntries(owner, repo, path, ref ?? undefined);

interface FileBrowserProps {
  owner: string;
  repo: string;
  gitRef?: string;
  selectedPath?: string;
  basePath: string;
}

export function FileBrowser({
  owner,
  repo,
  gitRef,
  selectedPath,
  basePath,
}: FileBrowserProps) {
  const cacheKey = `${owner}/${repo}`;

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(expansionCache.get(cacheKey)),
  );

  const toggle = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        expansionCache.set(cacheKey, next);
        return next;
      });
    },
    [cacheKey],
  );

  // Auto-expand ancestor dirs when the selected file changes.
  useEffect(() => {
    if (!selectedPath) return;
    const segments = selectedPath.split("/");
    const ancestors = segments
      .slice(0, -1)
      .map((_, i) => segments.slice(0, i + 1).join("/"));
    if (!ancestors.length) return;
    setExpanded((prev) => {
      if (ancestors.every((a) => prev.has(a))) return prev;
      const next = new Set(prev);
      ancestors.forEach((a) => next.add(a));
      expansionCache.set(cacheKey, next);
      return next;
    });
  }, [selectedPath, cacheKey]);

  return (
    <div className="h-full overflow-y-auto pb-8">
      <div className="px-2 py-2">
        <TreeLevel
          owner={owner}
          repo={repo}
          path=""
          gitRef={gitRef ?? null}
          depth={0}
          expanded={expanded}
          selectedPath={selectedPath}
          basePath={basePath}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}

function TreeLevel({
  owner,
  repo,
  path,
  gitRef,
  depth,
  expanded,
  selectedPath,
  basePath,
  onToggle,
}: {
  owner: string;
  repo: string;
  path: string;
  gitRef: string | null;
  depth: number;
  expanded: Set<string>;
  selectedPath?: string;
  basePath: string;
  onToggle: (path: string) => void;
}) {
  const key: TreeKey = ["tree", owner, repo, path, gitRef];

  const { data: entries, isLoading } = useSWRImmutable(key, treeFetcher);

  // Prefetch one level deeper. preload() checks the SWR cache before firing so
  // repeated renders / remounts for already-cached paths are no-ops.
  // Must be in an effect — preload() touches SWR state and can't run in render.
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (!entries || prefetchedRef.current) return;
    prefetchedRef.current = true;
    for (const entry of entries) {
      if (entry.type === "dir") {
        preload(["tree", owner, repo, entry.path, gitRef] as const, treeFetcher);
      }
    }
  }, [entries, owner, repo, gitRef]);

  if (isLoading) {
    return (
      <div
        className="py-1 text-xs text-muted-foreground"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        Loading…
      </div>
    );
  }

  if (!entries?.length) return null;

  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      {sorted.map((entry) => (
        <div key={entry.path}>
          <FileTreeNode
            entry={entry}
            depth={depth}
            isActive={selectedPath === entry.path}
            isExpanded={expanded.has(entry.path)}
            basePath={basePath}
            onToggle={() => onToggle(entry.path)}
          />
          {entry.type === "dir" && expanded.has(entry.path) && (
            <TreeLevel
              owner={owner}
              repo={repo}
              path={entry.path}
              gitRef={gitRef}
              depth={depth + 1}
              expanded={expanded}
              selectedPath={selectedPath}
              basePath={basePath}
              onToggle={onToggle}
            />
          )}
        </div>
      ))}
    </>
  );
}
