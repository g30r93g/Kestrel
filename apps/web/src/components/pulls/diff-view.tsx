"use client";

import { fetchPullRequest, fetchPullRequestPatches, type PatchFile } from "@/lib/github/pulls";
import { ReviewDraftProvider, ReviewDraftContext } from "@/components/pulls/review-draft-context";
import type { PendingReviewComment } from "@/lib/github/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronToggle } from "@/components/ui/chevron-toggle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useCallback, useContext, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiffMode = "unified" | "split";

interface ParsedLine {
  type: "hunkHeader" | "context" | "add" | "remove";
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface SplitRow {
  type: "hunkHeader" | "context" | "change";
  header?: string;
  oldLine?: number;
  newLine?: number;
  oldContent?: string;
  newContent?: string;
}

interface DiffNode {
  name: string;
  path: string;
  type: "dir" | "file";
  children: DiffNode[];
  file?: PatchFile;
}

interface FileReviewProps {
  openComment: {
    line: number;
    startLine?: number;
    side: "LEFT" | "RIGHT";
    startSide?: "LEFT" | "RIGHT";
    quotedText?: string;
  } | null;
  lineSelection: {
    anchorLine: number;
    activeLine: number;
    side: "LEFT" | "RIGHT";
  } | null;
  pendingComments: PendingReviewComment[];
  onLineClick: (line: number, side: "LEFT" | "RIGHT", shiftKey: boolean) => void;
  onCloseComment: () => void;
  onAddComment: (body: string) => void;
  onUpdateComment: (id: string, body: string) => void;
  onRemoveComment: (id: string) => void;
}

// ─── Patch Parsing ────────────────────────────────────────────────────────────

function parsePatch(patch: string): ParsedLine[] {
  const result: ParsedLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldLine = parseInt(m[1], 10); newLine = parseInt(m[2], 10); }
      result.push({ type: "hunkHeader", content: raw });
    } else if (raw.startsWith("+")) {
      result.push({ type: "add", content: raw.slice(1), newLine: newLine++ });
    } else if (raw.startsWith("-")) {
      result.push({ type: "remove", content: raw.slice(1), oldLine: oldLine++ });
    } else if (!raw.startsWith("\\")) {
      result.push({ type: "context", content: raw.length > 0 ? raw.slice(1) : "", oldLine: oldLine++, newLine: newLine++ });
    }
  }
  return result;
}

function toSplitRows(lines: ParsedLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  const buf: Array<{ content: string; oldLine: number }> = [];

  const flush = () => {
    while (buf.length) {
      const r = buf.shift()!;
      rows.push({ type: "change", oldLine: r.oldLine, oldContent: r.content });
    }
  };

  for (const line of lines) {
    if (line.type === "hunkHeader") {
      flush();
      rows.push({ type: "hunkHeader", header: line.content });
    } else if (line.type === "remove") {
      buf.push({ content: line.content, oldLine: line.oldLine! });
    } else if (line.type === "add") {
      if (buf.length) {
        const r = buf.shift()!;
        rows.push({ type: "change", oldLine: r.oldLine, newLine: line.newLine, oldContent: r.content, newContent: line.content });
      } else {
        rows.push({ type: "change", newLine: line.newLine, newContent: line.content });
      }
    } else {
      flush();
      rows.push({ type: "context", oldLine: line.oldLine, newLine: line.newLine, oldContent: line.content, newContent: line.content });
    }
  }
  flush();
  return rows;
}

// ─── File Tree ────────────────────────────────────────────────────────────────

function buildTree(files: PatchFile[]): DiffNode[] {
  const root: DiffNode[] = [];
  for (const file of files) {
    const parts = file.filename.split("/");
    let nodes = root;
    let cur = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      cur = cur ? `${cur}/${part}` : part;
      const isLeaf = i === parts.length - 1;
      let node = nodes.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: cur, type: isLeaf ? "file" : "dir", children: [] };
        if (isLeaf) node.file = file;
        nodes.push(node);
      }
      nodes = node.children;
    }
  }
  return root;
}

const toAnchorId = (filename: string) => `diff-${filename.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

function TreeNode({ node, depth, expanded, onToggle }: {
  node: DiffNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isExpanded = expanded.has(node.path);
  const indent = depth * 12;

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => onToggle(node.path)}
          style={{ paddingLeft: `${8 + indent}px` }}
          className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm transition-colors hover:bg-muted/60"
        >
          <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-150", isExpanded && "rotate-90")} />
          {isExpanded
            ? <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
            : <Folder className="size-4 shrink-0 text-muted-foreground" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map((c) => (
          <TreeNode key={c.path} node={c} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
        ))}
      </div>
    );
  }

  const fileColor =
    node.file?.status === "added" ? "text-green-600" :
    node.file?.status === "removed" ? "text-red-500" :
    node.file?.status === "renamed" || node.file?.status === "copied" ? "text-blue-500" :
    node.file?.status === "modified" || node.file?.status === "changed" ? "text-amber-500" :
    "text-muted-foreground";

  return (
    <a
      href={`#${toAnchorId(node.path)}`}
      style={{ paddingLeft: `${8 + 14 + indent}px` }}
      className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm transition-colors hover:bg-muted/60"
    >
      <File className={cn("size-4 shrink-0", fileColor)} />
      <span className="truncate">{node.name}</span>
    </a>
  );
}

function DiffFileTree({ files }: { files: PatchFile[] }) {
  const tree = buildTree(files);

  const collectDirs = (nodes: DiffNode[]): string[] =>
    nodes.flatMap((n) => n.type === "dir" ? [n.path, ...collectDirs(n.children)] : []);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(collectDirs(tree)));

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) { next.delete(path); } else { next.add(path); }
      return next;
    });
  }, []);

  return (
    <div className="px-2 py-2">
      {tree.map((n) => (
        <TreeNode key={n.path} node={n} depth={0} expanded={expanded} onToggle={toggle} />
      ))}
    </div>
  );
}

// ─── Diff Renderers ───────────────────────────────────────────────────────────

const NUM = "w-10 shrink-0 select-none border-r px-1.5 text-right font-mono text-xs text-muted-foreground/50";

function UnifiedDiff({ lines, reviewProps }: { lines: ParsedLine[]; reviewProps?: FileReviewProps }) {
  return (
    <div className="w-max min-w-full">
      {lines.map((line, i) => {
        if (line.type === "hunkHeader") {
          return (
            <div key={i} className="flex bg-muted">
              <span className={NUM} />
              <span className={NUM} />
              <span className="flex-1 whitespace-pre px-3 py-0.5 font-mono text-xs text-muted-foreground">{line.content}</span>
            </div>
          );
        }
        if (line.type === "add") {
          return (
            <div key={i} className="flex bg-green-50 dark:bg-green-950/40">
              <span className={NUM} />
              <span className={cn(NUM, "bg-green-100/60 dark:bg-green-900/40")}>{line.newLine}</span>
              <span className="flex-1 whitespace-pre px-3 py-0 font-mono text-xs text-green-800 dark:text-green-300">+{line.content}</span>
            </div>
          );
        }
        if (line.type === "remove") {
          return (
            <div key={i} className="flex bg-red-50 dark:bg-red-950/40">
              <span className={cn(NUM, "bg-red-100/60 dark:bg-red-900/40")}>{line.oldLine}</span>
              <span className={NUM} />
              <span className="flex-1 whitespace-pre px-3 py-0 font-mono text-xs text-red-800 dark:text-red-300">-{line.content}</span>
            </div>
          );
        }
        return (
          <div key={i} className="flex">
            <span className={NUM}>{line.oldLine}</span>
            <span className={NUM}>{line.newLine}</span>
            <span className="flex-1 whitespace-pre px-3 py-0 font-mono text-xs text-foreground"> {line.content}</span>
          </div>
        );
      })}
    </div>
  );
}

function SplitDiff({ rows, reviewProps }: { rows: SplitRow[]; reviewProps?: FileReviewProps }) {
  return (
    <div className="min-w-full">
      {rows.map((row, i) => {
        if (row.type === "hunkHeader") {
          return (
            <div key={i} className="flex bg-muted">
              <span className="flex-1 whitespace-pre px-3 py-0.5 font-mono text-xs text-muted-foreground">{row.header}</span>
            </div>
          );
        }

        const isOldChange = row.type === "change" && row.oldContent !== undefined;
        const isNewChange = row.type === "change" && row.newContent !== undefined;

        return (
          <div key={i} className="flex min-w-0">
            <div className={cn("flex min-w-0 flex-1 overflow-x-auto", isOldChange && "bg-red-50 dark:bg-red-950/40")}>
              <span className={cn(NUM, isOldChange ? "bg-red-100/60 dark:bg-red-900/40" : "")}>{row.oldLine ?? ""}</span>
              <span className={cn("flex-1 whitespace-pre px-3 py-0 font-mono text-xs", isOldChange ? "text-red-800 dark:text-red-300" : "text-foreground")}>
                {row.oldContent ?? ""}
              </span>
            </div>
            <div className="w-px shrink-0 bg-border" />
            <div className={cn("flex min-w-0 flex-1 overflow-x-auto", isNewChange && "bg-green-50 dark:bg-green-950/40")}>
              <span className={cn(NUM, isNewChange ? "bg-green-100/60 dark:bg-green-900/40" : "")}>{row.newLine ?? ""}</span>
              <span className={cn("flex-1 whitespace-pre px-3 py-0 font-mono text-xs", isNewChange ? "text-green-800 dark:text-green-300" : "text-foreground")}>
                {row.newContent ?? ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── File Patch Card ──────────────────────────────────────────────────────────

function FilePatch({
  file,
  mode,
  reviewMode = false,
  fileReviewProps,
}: {
  file: PatchFile;
  mode: DiffMode;
  reviewMode?: boolean;
  fileReviewProps?: FileReviewProps;
}) {
  const [open, setOpen] = useState(true);
  const lines = file.patch ? parsePatch(file.patch) : [];
  const splitRows = mode === "split" ? toSplitRows(lines) : [];

  return (
    <div id={toAnchorId(file.filename)} className="scroll-mt-12 rounded-lg border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.filename}</span>
        <span className="shrink-0 text-xs text-green-600">+{file.additions}</span>
        <span className="shrink-0 text-xs text-red-500">−{file.deletions}</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronToggle open={open} className="size-4" />
        </button>
      </div>
      {open && (
        <div className="overflow-x-auto border-t">
          {file.patch === null ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">Binary file — no diff available.</p>
          ) : mode === "unified" ? (
            <UnifiedDiff lines={lines} reviewProps={fileReviewProps} />
          ) : (
            <SplitDiff rows={splitRows} reviewProps={fileReviewProps} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inner View (rendered inside ReviewDraftProvider) ────────────────────────

interface DiffViewInnerProps {
  owner: string;
  repo: string;
  prNumber: number;
  mode: DiffMode;
  setMode: (m: DiffMode) => void;
  files: PatchFile[];
  isLoading: boolean;
  reviewMode: boolean;
  commitSha: string;
}

function DiffViewInner({
  owner,
  repo,
  prNumber,
  mode,
  setMode,
  files,
  isLoading,
  reviewMode,
  commitSha,
}: DiffViewInnerProps) {
  // Always call useContext — never conditional. When ReviewDraftProvider is
  // disabled (enabled=false) it renders children without providing a value,
  // so ctx will be null. We guard all draft actions behind the null check.
  const ctx = useContext(ReviewDraftContext);
  const draft = ctx?.draft ?? { commitSha: "", comments: [], markedFiles: [], body: "" };
  const addComment = ctx?.addComment ?? (() => {});
  const updateComment = ctx?.updateComment ?? (() => {});
  const removeComment = ctx?.removeComment ?? (() => {});

  const [openComment, setOpenComment] = useState<{
    path: string;
    line: number;
    startLine?: number;
    side: "LEFT" | "RIGHT";
    startSide?: "LEFT" | "RIGHT";
    quotedText?: string;
  } | null>(null);

  const [lineSelection, setLineSelection] = useState<{
    path: string;
    anchorLine: number;
    activeLine: number;
    side: "LEFT" | "RIGHT";
  } | null>(null);

  const handleLineClick = useCallback(
    (path: string, line: number, side: "LEFT" | "RIGHT", shiftKey: boolean) => {
      if (
        shiftKey &&
        lineSelection &&
        lineSelection.path === path &&
        lineSelection.side === side
      ) {
        const next = { ...lineSelection, activeLine: line };
        setLineSelection(next);
        const minLine = Math.min(next.anchorLine, next.activeLine);
        const maxLine = Math.max(next.anchorLine, next.activeLine);
        setOpenComment({
          path,
          line: maxLine,
          startLine: minLine < maxLine ? minLine : undefined,
          side,
          startSide: minLine < maxLine ? side : undefined,
        });
      } else {
        setLineSelection({ path, anchorLine: line, activeLine: line, side });
        setOpenComment({ path, line, side });
      }
    },
    [lineSelection],
  );

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* File tree sidebar */}
      <aside className="hidden w-52 shrink-0 overflow-y-auto border-r md:block">
        {isLoading ? (
          <div className="space-y-1.5 p-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-4" />)}
          </div>
        ) : (
          <DiffFileTree files={files} />
        )}
      </aside>

      {/* Main diff area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <Link
            href={`/${owner}/${repo}/pulls/${prNumber}`}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to PR #{prNumber}
          </Link>
          <Tabs value={mode} onValueChange={(v) => setMode(v as DiffMode)}>
            <TabsList>
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* File patches */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 [scrollbar-gutter:stable]">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border bg-card p-4">
                  <Skeleton className="mb-2 h-4 w-64" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && files.length === 0 && (
            <p className="text-sm text-muted-foreground">No file changes in this PR.</p>
          )}
          {!isLoading &&
            files.map((f) => (
              <FilePatch
                key={f.filename}
                file={f}
                mode={mode}
                reviewMode={reviewMode}
                fileReviewProps={
                  reviewMode
                    ? {
                        openComment:
                          openComment?.path === f.filename
                            ? {
                                line: openComment.line,
                                startLine: openComment.startLine,
                                side: openComment.side,
                                startSide: openComment.startSide,
                                quotedText: openComment.quotedText,
                              }
                            : null,
                        lineSelection:
                          lineSelection?.path === f.filename
                            ? {
                                anchorLine: lineSelection.anchorLine,
                                activeLine: lineSelection.activeLine,
                                side: lineSelection.side,
                              }
                            : null,
                        pendingComments: draft.comments.filter(
                          (c) => c.path === f.filename,
                        ),
                        onLineClick: (line, side, shiftKey) =>
                          handleLineClick(f.filename, line, side, shiftKey),
                        onCloseComment: () => {
                          setOpenComment(null);
                          setLineSelection(null);
                        },
                        onAddComment: (body) => {
                          if (!openComment) return;
                          addComment({
                            path: openComment.path,
                            body,
                            line: openComment.line,
                            startLine: openComment.startLine,
                            side: openComment.side,
                            startSide: openComment.startSide,
                            quotedText: openComment.quotedText,
                          });
                          setOpenComment(null);
                          setLineSelection(null);
                        },
                        onUpdateComment: updateComment,
                        onRemoveComment: removeComment,
                      }
                    : undefined
                }
              />
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Top-level View ───────────────────────────────────────────────────────────

interface DiffViewProps {
  owner: string;
  repo: string;
  prNumber: number;
}

export function DiffView({ owner, repo, prNumber }: DiffViewProps) {
  const [mode, setMode] = useState<DiffMode>("unified");
  const searchParams = useSearchParams();
  const reviewMode = searchParams.get("review") === "true";

  const { data: files = [], isLoading } = useSWR(
    [owner, repo, prNumber, "patches"],
    ([o, r, n]) => fetchPullRequestPatches(o, r, n),
  );

  const { data: pr } = useSWR(
    reviewMode ? [owner, repo, prNumber, "pr"] : null,
    ([o, r, n]) => fetchPullRequest(o, r, n),
  );

  const commitSha = pr?.headSha ?? "";

  return (
    <ReviewDraftProvider
      owner={owner}
      repo={repo}
      prNumber={prNumber}
      commitSha={commitSha}
      enabled={reviewMode}
    >
      <DiffViewInner
        owner={owner}
        repo={repo}
        prNumber={prNumber}
        mode={mode}
        setMode={setMode}
        files={files}
        isLoading={isLoading}
        reviewMode={reviewMode}
        commitSha={commitSha}
      />
    </ReviewDraftProvider>
  );
}
