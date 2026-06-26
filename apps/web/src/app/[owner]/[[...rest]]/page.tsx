import { resolveNav } from "@/lib/nav-tree";
import { getOctokit } from "@/lib/github/client";
import { BranchesView } from "@/components/branches/branches-view";
import type { BranchFilter } from "@/lib/github/types";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ owner: string; rest?: string[] }>;
}) {
  const { owner, rest } = await params;
  const segments = rest ?? [];
  const model = resolveNav(owner, segments);

  // Branches: /{owner}/{repo}/branches[/{filter}]
  if (segments.length >= 2 && segments[1] === "branches") {
    const repo = segments[0];
    const filter = (segments[2] ?? "all") as BranchFilter;

    const octokit = await getOctokit();
    const { data: ghUser } = await octokit.rest.users.getAuthenticated();

    return (
      <BranchesView
        owner={owner}
        repo={repo}
        filter={filter}
        currentUserLogin={ghUser.login}
      />
    );
  }

  const here =
    model.header?.label ?? (model.context === "repo" ? (segments[0] ?? owner) : owner);

  return (
    <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">{here}</div>
      <div className="mt-1">
        Context: {model.context} · path: /{[owner, ...segments].join("/")}
      </div>
      <div className="mt-1">Content for this view lands in a later slice.</div>
    </div>
  );
}
