"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BlameRange, FileData, HighlightToken } from "@/lib/github/types";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import { useTheme } from "next-themes";
import { Fragment } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export type FileInspectorProps =
  | { mode: "empty" }
  | { mode: "loading" }
  | { mode: "error" }
  | { mode: "file"; fileData: FileData; blame?: BlameRange[] }
  | { mode: "diff"; hunks: DiffHunk[] };

// ─── Shared constants ─────────────────────────────────────────────────────────

const LINE_NO = "select-none py-px tabular-nums text-muted-foreground/40 font-mono text-sm";

// Explicit cell width sized to the digit count of the max line number.
// Setting width (not just padding) removes table-layout ambiguity.
// Tight, fixed padding on both sides; text-right aligns numbers naturally.
function lineNoStyle(totalLines: number): React.CSSProperties {
  const digits = String(totalLines).length;
  return { width: "3rem", paddingLeft: `2em - calc(${digits}ch)`, paddingRight: "1rem" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blameForLine(lineNo: number, ranges: BlameRange[]): BlameRange | undefined {
  return ranges.find((r) => lineNo >= r.startLine && lineNo <= r.endLine);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function tokenStyle(token: HighlightToken, dark: boolean): React.CSSProperties | undefined {
  const s = token.htmlStyle;
  if (!s) return undefined;
  const p = dark ? "--shiki-dark" : "--shiki-light";
  return {
    color: s[p],
    fontStyle: s[`${p}-font-style`],
    fontWeight: s[`${p}-font-weight`],
    textDecoration: s[`${p}-text-decoration`],
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Naive but correct RFC 4180 CSV line parser.
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      cells.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

// ─── Text / source viewer ─────────────────────────────────────────────────────

function FileContent({
  content,
  highlighted,
  blame = [],
}: {
  content: string;
  highlighted: HighlightToken[][] | null;
  blame?: BlameRange[];
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const lines = content.split("\n");
  if (lines.at(-1) === "") lines.pop();

  const lnStyle = lineNoStyle(lines.length);

  return (
    <TooltipProvider delay={300}>
      <div className="flex-1 overflow-auto pb-8 [scrollbar-gutter:stable]">
        <table className="min-w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              const lineNo = i + 1;
              const range = blame.length ? blameForLine(lineNo, blame) : undefined;
              const tokenLine = highlighted?.[i];

              const lineNoCell = range ? (
                <Tooltip>
                  <TooltipTrigger
                    className={cn(LINE_NO, "cursor-default text-right hover:text-muted-foreground/80")}
                    style={lnStyle}
                    render={<td />}
                  >
                    {lineNo}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-56 space-y-0.5 text-left flex flex-col">
                    <div className="font-mono">{range.commitSha}</div>
                    <div className="opacity-70">{formatDate(range.commitDate)}</div>
                    <div className="opacity-90">{range.commitMessage}</div>
                    {range.prNumber && (
                      <div className="opacity-70">
                        #{range.prNumber} {range.prTitle}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <td className={cn(LINE_NO, "text-right")} style={lnStyle}>{lineNo}</td>
              );

              return (
                <tr key={i} className="hover:bg-muted/30">
                  {lineNoCell}
                  <td className="pr-6 font-mono text-sm whitespace-pre">
                    {tokenLine
                      ? tokenLine.map((t, ti) => (
                          <span key={ti} style={tokenStyle(t, dark)}>
                            {t.content}
                          </span>
                        ))
                      : (line || "​")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}

// ─── Image viewer ─────────────────────────────────────────────────────────────

function ImageViewer({ dataUri }: { dataUri: string }) {
  return (
    <div
      className="flex-1 min-h-0 relative"
      style={{
        backgroundImage: "repeating-conic-gradient(#e0e0e0 0% 25%, #ffffff 0% 50%)",
        backgroundSize: "16px 16px",
      }}
    >
      <img
        src={dataUri}
        alt=""
        className="absolute inset-0 h-full w-full object-contain p-8"
      />
    </div>
  );
}

// ─── SVG viewer (preview + source tabs) ──────────────────────────────────────

function SvgViewer({
  content,
  dataUri,
  highlighted,
}: {
  content: string;
  dataUri: string;
  highlighted: HighlightToken[][] | null;
}) {
  return (
    <Tabs defaultValue="preview" className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center border-b px-4 shrink-0">
        <TabsList variant="line" className="h-9 gap-0">
          <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          <TabsTrigger value="source" className="text-xs">Source</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="preview" className="flex flex-col flex-1 min-h-0">
        <div
          className="flex-1 min-h-0 relative"
          style={{
            backgroundImage: "repeating-conic-gradient(#e0e0e0 0% 25%, #ffffff 0% 50%)",
            backgroundSize: "16px 16px",
          }}
        >
          <img
            src={dataUri}
            alt=""
            className="absolute inset-0 h-full w-full object-contain p-8"
          />
        </div>
      </TabsContent>
      <TabsContent value="source" className="flex flex-col flex-1 min-h-0">
        <FileContent content={content} highlighted={highlighted} />
      </TabsContent>
    </Tabs>
  );
}

// ─── Markdown viewer (rendered + source tabs) ─────────────────────────────────

function MarkdownViewer({
  content,
  highlighted,
}: {
  content: string;
  highlighted: HighlightToken[][] | null;
}) {
  return (
    <Tabs defaultValue="preview" className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center border-b px-4 shrink-0">
        <TabsList variant="line" className="h-9 gap-0">
          <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          <TabsTrigger value="source" className="text-xs">Source</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="preview" className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-auto px-12 py-8 [scrollbar-gutter:stable]">
          <div className="prose prose-sm dark:prose-invert max-w-3xl">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="source" className="flex flex-col flex-1 min-h-0">
        <FileContent content={content} highlighted={highlighted} />
      </TabsContent>
    </Tabs>
  );
}

// ─── CSV viewer ───────────────────────────────────────────────────────────────

function CsvViewer({ content }: { content: string }) {
  const rawLines = content.trim().split("\n");
  const rows = rawLines.map(parseCsvLine);
  const [header, ...body] = rows;

  return (
    <div className="flex-1 overflow-auto pb-8 [scrollbar-gutter:stable]">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {header?.map((cell, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 py-2 text-left font-mono font-medium text-xs text-muted-foreground"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50 hover:bg-muted/20">
              {row.map((cell, ci) => (
                <td key={ci} className="whitespace-nowrap px-4 py-1.5 font-mono text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        {body.length} row{body.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ─── Binary fallback ──────────────────────────────────────────────────────────

function BinaryFallback({ size, downloadUrl }: { size: number; downloadUrl: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="text-sm text-muted-foreground">
        Binary file · {formatBytes(size)}
      </p>
      {downloadUrl && (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={downloadUrl} download />}
        >
          <Download className="mr-1.5 size-3.5" />
          Download
        </Button>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

// Indent level → left-padding offset in px (matches 2-space indent at 7px/ch).
const INDENT_PX = 14;

// A plausible-looking snippet of code structure to fill the skeleton.
const SKELETON_LINES: { indent: number; w: string }[] = [
  { indent: 0, w: "68%" },
  { indent: 1, w: "52%" },
  { indent: 1, w: "74%" },
  { indent: 2, w: "40%" },
  { indent: 2, w: "58%" },
  { indent: 2, w: "46%" },
  { indent: 1, w: "0"   },
  { indent: 1, w: "62%" },
  { indent: 1, w: "38%" },
  { indent: 0, w: "0"   },
  { indent: 0, w: "48%" },
  { indent: 1, w: "72%" },
  { indent: 1, w: "55%" },
  { indent: 2, w: "36%" },
  { indent: 2, w: "64%" },
  { indent: 1, w: "0"   },
  { indent: 1, w: "44%" },
  { indent: 0, w: "30%" },
  { indent: 0, w: "0"   },
  { indent: 0, w: "56%" },
];

function CodeSkeleton() {
  const lnStyle = lineNoStyle(SKELETON_LINES.length);
  return (
    <div className="flex-1 overflow-hidden animate-pulse">
      <table className="min-w-full border-collapse">
        <tbody>
          {SKELETON_LINES.map(({ indent, w }, i) => (
            <tr key={i}>
              <td
                className="py-px text-right font-mono text-sm tabular-nums text-muted-foreground/40 align-middle"
                style={lnStyle}
              >
                {i + 1}
              </td>
              <td className="py-px pr-6 align-middle">
                {w !== "0" && (
                  <div
                    className="h-3 rounded-sm bg-muted"
                    style={{ width: w, marginLeft: indent * INDENT_PX }}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function FileInspector(props: FileInspectorProps) {
  if (props.mode === "empty") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a file to view</p>
      </div>
    );
  }

  if (props.mode === "loading") {
    return <CodeSkeleton />;
  }

  if (props.mode === "error") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Could not load file.</p>
      </div>
    );
  }

  if (props.mode === "file") {
    const { fileData, blame } = props;
    switch (fileData.kind) {
      case "text":
        return <FileContent content={fileData.content} highlighted={fileData.highlighted} blame={blame} />;
      case "image":
        return <ImageViewer dataUri={fileData.dataUri} />;
      case "svg":
        return <SvgViewer content={fileData.content} dataUri={fileData.dataUri} highlighted={fileData.highlighted} />;
      case "markdown":
        return <MarkdownViewer content={fileData.content} highlighted={fileData.highlighted} />;
      case "csv":
        return <CsvViewer content={fileData.content} />;
      case "binary":
        return <BinaryFallback size={fileData.size} downloadUrl={fileData.downloadUrl} />;
    }
  }

  // Diff mode
  return (
    <div className="flex-1 overflow-auto pb-8 [scrollbar-gutter:stable]">
      <table className="min-w-full border-collapse">
        <tbody>
          {props.hunks.map((hunk, hi) => (
            <Fragment key={hi}>
              <tr>
                <td
                  colSpan={4}
                  className="bg-muted/40 px-6 py-1 font-mono text-xs text-muted-foreground"
                >
                  {hunk.header}
                </td>
              </tr>
              {hunk.lines.map((line, li) => {
                const marker =
                  line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
                const rowBg =
                  line.type === "add"
                    ? "bg-green-500/10"
                    : line.type === "remove"
                      ? "bg-red-500/10"
                      : "";
                return (
                  <tr key={`${hi}-${li}`} className={rowBg}>
                    <td className="w-5 select-none py-px text-center font-mono text-sm text-muted-foreground/60">
                      {marker}
                    </td>
                    <td className={cn(LINE_NO, "w-10 pr-2 text-right")}>
                      {line.oldLineNo ?? ""}
                    </td>
                    <td className={cn(LINE_NO, "w-10 pr-4 text-right")}>
                      {line.newLineNo ?? ""}
                    </td>
                    <td className="pr-6 font-mono text-sm whitespace-pre">
                      {line.content || "​"}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
