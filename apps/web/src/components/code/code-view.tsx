"use client";

import { fetchBlame, fetchFileCommit, fetchFileContent } from "@/lib/github/tree";
import { useSearchParams } from "next/navigation";
import useSWRImmutable from "swr/immutable";
import { FileBrowser } from "./file-browser";
import { FileHeader } from "./file-header";
import { FileInspector, type FileInspectorProps } from "./file-inspector";

interface CodeViewProps {
  owner: string;
  repo: string;
  selectedPath?: string;
}

export function CodeView({ owner, repo, selectedPath }: CodeViewProps) {
  const searchParams = useSearchParams();
  const gitRef = searchParams.get("ref") ?? undefined;
  const basePath = `/${owner}/${repo}/code`;

  const { data: fileData, isLoading } = useSWRImmutable(
    selectedPath ? ["file", owner, repo, selectedPath, gitRef] : null,
    () => fetchFileContent(owner, repo, selectedPath!, gitRef),
  );

  const { data: commit = null } = useSWRImmutable(
    selectedPath ? ["commit", owner, repo, selectedPath, gitRef] : null,
    () => fetchFileCommit(owner, repo, selectedPath!, gitRef),
  );

  const { data: blame = [] } = useSWRImmutable(
    selectedPath && fileData ? ["blame", owner, repo, selectedPath, gitRef] : null,
    () => fetchBlame(owner, repo, selectedPath!, gitRef),
  );

  const inspectorProps: FileInspectorProps = !selectedPath
    ? { mode: "empty" }
    : isLoading
      ? { mode: "loading" }
      : fileData == null
        ? { mode: "error" }
        : { mode: "file", fileData, blame };

  const downloadUrl = fileData?.downloadUrl ?? null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r overflow-hidden">
        <FileBrowser
          owner={owner}
          repo={repo}
          gitRef={gitRef}
          selectedPath={selectedPath}
          basePath={basePath}
        />
      </aside>
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {selectedPath && (
          <FileHeader
            path={selectedPath}
            commit={commit}
            downloadUrl={downloadUrl}
          />
        )}
        {/* {fileData?.kind === "text" && fileData.wasFormatted && (
          <div className="flex shrink-0 items-center gap-1.5 border-b bg-blue-50 px-4 py-1.5 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
            <Wand2 className="size-3 shrink-0" />
            Minified file which has been pretty-printed for better readability.
          </div>
        )} */}
        <FileInspector {...inspectorProps} />
      </div>
    </div>
  );
}
