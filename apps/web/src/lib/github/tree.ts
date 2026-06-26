"use server";

import { getOctokit } from "./client";
import { highlightCode } from "../highlight";
import { formatCode, isMinified } from "../format";
import type { BlameRange, FileCommit, FileData, TreeEntry } from "./types";

// Extensions that map to a MIME type for raster image rendering.
const RASTER_MIME: Record<string, string> = {
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp:  "image/bmp",
  tiff: "image/tiff",
  ico:  "image/x-icon",
};

// Extensions that are definitively non-text binary with no useful source view.
const BINARY_EXTS = new Set([
  "wasm", "pyc", "class", "exe", "dll", "so", "dylib",
  "zip", "tar", "gz", "7z", "rar", "br",
  "sqlite", "db",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "wav", "ogg", "flac", "aac", "m4a",
  "mp4", "webm", "mov", "avi", "mkv",
  "pdf",
]);

function ext(path: string): string {
  const name = path.split("/").pop() ?? "";
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export async function fetchTreeEntries(
  owner: string,
  repo: string,
  path: string,
  gitRef?: string,
): Promise<TreeEntry[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: path || "",
      ref: gitRef,
    });
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type as TreeEntry["type"],
      sha: item.sha,
      size: item.size,
    }));
  } catch {
    return [];
  }
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  gitRef?: string,
): Promise<FileData | null> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: gitRef,
    });
    if (Array.isArray(data) || data.type !== "file") return null;

    const fileExt = ext(path);
    const downloadUrl = data.download_url ?? null;

    // GitHub returns encoding:"none" and empty content for files > 1 MB.
    const hasContent = data.encoding === "base64" && !!data.content;
    const raw = hasContent ? data.content.replace(/\n/g, "") : "";

    // ── Raster image ───────────────────────────────────────────────────────────
    const mime = RASTER_MIME[fileExt];
    if (mime) {
      if (!raw) return { kind: "binary", size: data.size ?? 0, downloadUrl };
      return { kind: "image", dataUri: `data:${mime};base64,${raw}`, mimeType: mime, downloadUrl };
    }

    // ── SVG ────────────────────────────────────────────────────────────────────
    if (fileExt === "svg") {
      const raw_content = raw ? Buffer.from(raw, "base64").toString("utf-8") : "";
      // Design tools (Figma, Illustrator) export single-line SVGs — always format.
      const content = raw_content ? await formatCode(raw_content, path, { alwaysFormat: true }) : "";
      const dataUri = content ? `data:image/svg+xml;base64,${Buffer.from(content).toString("base64")}` : "";
      const highlighted = content ? await highlightCode(content, path) : null;
      return { kind: "svg", content, dataUri, highlighted, downloadUrl };
    }

    // ── Known binary (no useful text view) ─────────────────────────────────────
    if (BINARY_EXTS.has(fileExt)) {
      return { kind: "binary", size: data.size ?? 0, downloadUrl };
    }

    // ── No content (file too large) ────────────────────────────────────────────
    if (!raw) return { kind: "binary", size: data.size ?? 0, downloadUrl };

    // ── Text-based formats ─────────────────────────────────────────────────────
    const raw_content = Buffer.from(raw, "base64").toString("utf-8");

    if (fileExt === "md" || fileExt === "mdx") {
      const highlighted = await highlightCode(raw_content, path);
      return { kind: "markdown", content: raw_content, highlighted, downloadUrl };
    }

    if (fileExt === "csv" || fileExt === "tsv") {
      return { kind: "csv", content: raw_content, downloadUrl };
    }

    // Format if minified. Happens server-side so highlights align with the
    // formatted output. Track whether formatting was applied for the UI banner.
    const wasFormatted = isMinified(raw_content);
    const content = wasFormatted ? await formatCode(raw_content, path, { alwaysFormat: true }) : raw_content;
    const highlighted = await highlightCode(content, path);
    return { kind: "text", content, highlighted, downloadUrl, wasFormatted };
  } catch {
    return null;
  }
}

export async function fetchFileCommit(
  owner: string,
  repo: string,
  path: string,
  gitRef?: string,
): Promise<FileCommit | null> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      path,
      sha: gitRef,
      per_page: 1,
    });
    const commit = data[0];
    if (!commit) return null;
    return {
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      message: commit.commit.message.split("\n")[0],
      date: commit.commit.author?.date ?? commit.commit.committer?.date ?? "",
      authorName: commit.commit.author?.name ?? commit.author?.login ?? "Unknown",
    };
  } catch {
    return null;
  }
}

interface GraphQLBlameResponse {
  repository: {
    object: {
      blame: {
        ranges: Array<{
          startingLine: number;
          endingLine: number;
          commit: {
            abbreviatedOid: string;
            committedDate: string;
            messageHeadline: string;
            associatedPullRequests: {
              nodes: Array<{ number: number; title: string }>;
            };
          };
        }>;
      };
    } | null;
  };
}

export async function fetchBlame(
  owner: string,
  repo: string,
  path: string,
  gitRef?: string,
): Promise<BlameRange[]> {
  const octokit = await getOctokit();
  try {
    const result = await octokit.graphql<GraphQLBlameResponse>(
      `
      query GetBlame($owner: String!, $name: String!, $expression: String!, $path: String!) {
        repository(owner: $owner, name: $name) {
          object(expression: $expression) {
            ... on Commit {
              blame(path: $path) {
                ranges {
                  startingLine
                  endingLine
                  commit {
                    abbreviatedOid
                    committedDate
                    messageHeadline
                    associatedPullRequests(first: 1) {
                      nodes { number title }
                    }
                  }
                }
              }
            }
          }
        }
      }
      `,
      { owner, name: repo, expression: gitRef ?? "HEAD", path },
    );
    const ranges = result.repository.object?.blame?.ranges ?? [];
    return ranges.map((r) => {
      const pr = r.commit.associatedPullRequests.nodes[0];
      return {
        startLine: r.startingLine,
        endLine: r.endingLine,
        commitSha: r.commit.abbreviatedOid,
        commitDate: r.commit.committedDate,
        commitMessage: r.commit.messageHeadline,
        prNumber: pr?.number,
        prTitle: pr?.title,
      };
    });
  } catch {
    return [];
  }
}
