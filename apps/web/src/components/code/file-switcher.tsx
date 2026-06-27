"use client";

import { useEffect, useRef, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronDown, File, Folder } from "lucide-react";
import { fetchTreeEntries } from "@/lib/github/tree";
import type { TreeEntry } from "@/lib/github/types";

type TreeKey = readonly ["tree", string, string, string, string | null];
const treeFetcher = ([, owner, repo, path, ref]: TreeKey) =>
  fetchTreeEntries(owner, repo, path, ref ?? undefined);

interface FileSwitcherProps {
  owner: string;
  repo: string;
  gitRef?: string;
  selectedPath?: string;
  basePath: string;
}

export function FileSwitcher({
  owner,
  repo,
  gitRef,
  selectedPath,
  basePath,
}: FileSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(0);
  const [currentDir, setCurrentDir] = useState("");

  // When opening, snap to the directory of the selected file.
  useEffect(() => {
    if (isOpen) {
      if (selectedPath) {
        const parts = selectedPath.split("/");
        setCurrentDir(parts.slice(0, -1).join("/"));
      } else {
        setCurrentDir("");
      }
    }
  }, [isOpen, selectedPath]);

  const key: TreeKey = ["tree", owner, repo, currentDir, gitRef ?? null];
  const { data: entries } = useSWRImmutable(isOpen ? key : null, treeFetcher);

  const sorted = entries
    ? [...entries].sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    : [];

  function open() {
    if (buttonRef.current) {
      setPanelTop(buttonRef.current.getBoundingClientRect().bottom);
    }
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  function handleDirClick(entry: TreeEntry) {
    setCurrentDir(entry.path);
  }

  function handleGoUp() {
    const parts = currentDir.split("/");
    setCurrentDir(parts.slice(0, -1).join("/"));
  }

  function handleFileClick(entry: TreeEntry) {
    const ref = searchParams.get("ref");
    router.push(`${basePath}/${entry.path}${ref ? `?ref=${ref}` : ""}`);
    close();
  }

  const displayDir = currentDir ? `${currentDir}/` : "/";

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        onClick={isOpen ? close : open}
        className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-sm"
      >
        <File className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left font-mono text-xs">
          {selectedPath ?? "Browse files…"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />

          <div
            className="fixed left-0 right-0 z-50 border-b bg-background shadow-lg"
            style={{ top: panelTop }}
          >
            <div className="border-b px-4 py-1.5 font-mono text-xs text-muted-foreground">
              {displayDir}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {currentDir !== "" && (
                <>
                  <button
                    onClick={handleGoUp}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/60"
                  >
                    <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">.. Go up a level</span>
                  </button>
                  <div className="border-t border-dashed" />
                </>
              )}

              {!entries && (
                <div className="px-4 py-3 text-xs text-muted-foreground">
                  Loading…
                </div>
              )}

              {sorted.map((entry) =>
                entry.type === "dir" ? (
                  <button
                    key={entry.path}
                    onClick={() => handleDirClick(entry)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/60"
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {entry.name}
                      <span className="text-muted-foreground">/</span>
                    </span>
                  </button>
                ) : (
                  <button
                    key={entry.path}
                    onClick={() => handleFileClick(entry)}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/60",
                      selectedPath === entry.path &&
                        "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                    )}
                  >
                    <File className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-left">{entry.name}</span>
                    {selectedPath === entry.path && (
                      <span className="size-1.5 shrink-0 rounded-full bg-current" />
                    )}
                  </button>
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
