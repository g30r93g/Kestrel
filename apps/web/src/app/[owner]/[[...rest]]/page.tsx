import { resolveNav } from "@/lib/nav-tree";
import { getOctokit } from "@/lib/github/client";
import { BranchesView } from "@/components/branches/branches-view";
import { CodeView } from "@/components/code/code-view";
import type { BranchFilter } from "@/lib/github/types";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ owner: string; rest?: string[] }>;
}) {
  const { owner, rest } = await params;
  const segments = rest ?? [];

  // Code view: /{owner}/{repo}/code[/...path]
  if (segments.length >= 2 && segments[1] === "code") {
    const repo = segments[0];
    const selectedPath = segments.length > 2 ? segments.slice(2).join("/") : undefined;
    return <CodeView owner={owner} repo={repo} selectedPath={selectedPath} />;
  }

  // Branches: /{owner}/{repo}/branches[/{filter}]
  if (segments.length >= 2 && segments[1] === "branches") {
    const repo = segments[0];
    const filter = (segments[2] ?? "all") as BranchFilter;

    const octokit = await getOctokit();
    const { data: ghUser } = await octokit.rest.users.getAuthenticated();

    return (
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <BranchesView
          owner={owner}
          repo={repo}
          filter={filter}
          currentUserLogin={ghUser.login}
        />
      </div>
    );
  }

  const model = resolveNav(owner, segments);
  const here =
    model.header?.label ?? (model.context === "repo" ? (segments[0] ?? owner) : owner);

  return (
    <div className="p-4 md:p-6">
      <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
        <div className="font-medium text-foreground">{here}</div>
        <div className="mt-1">
          Context: {model.context} · path: /{[owner, ...segments].join("/")}
        </div>
        <div className="mt-1">Content for this view lands in a later slice.</div>
      </div>
    </div>
  );
}
