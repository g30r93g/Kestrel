import { resolveNav } from "@/lib/nav-tree";
import { getOctokit } from "@/lib/github/client";
import { BranchesView } from "@/components/branches/branches-view";
import { CodeView } from "@/components/code/code-view";
import { IssuesView } from "@/components/issues/issues-view";
import { PackagesView } from "@/components/packages/packages-view";
import { TagsAndReleasesView } from "@/components/tags-and-releases/tags-and-releases-view";
import { PullsView } from "@/components/pulls/pulls-view";
import { DiffView } from "@/components/pulls/diff-view";
import { ChecksView } from "@/components/pulls/checks-view";
import { ReviewsView } from "@/components/pulls/reviews-view";
import { PullsListView } from "@/components/pulls/pulls-list-view";
import type { BranchFilter, ReviewsFilter, PullsListFilter } from "@/lib/github/types";

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

  // Tags & Releases: /{owner}/{repo}/releases
  if (segments.length >= 2 && segments[1] === "releases") {
    const repo = segments[0];
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 [scrollbar-gutter:stable]">
        <TagsAndReleasesView owner={owner} repo={repo} />
      </div>
    );
  }

  // Packages: /{owner}/{repo}/packages
  if (segments.length >= 2 && segments[1] === "packages") {
    const repo = segments[0];
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 [scrollbar-gutter:stable]">
        <PackagesView key={`${owner}/${repo}`} owner={owner} repo={repo} />
      </div>
    );
  }

  // Issues: /{owner}/{repo}/issues
  if (segments.length >= 2 && segments[1] === "issues") {
    const repo = segments[0];
    return <IssuesView key={`${owner}/${repo}`} owner={owner} repo={repo} />;
  }

  // Reviews queue: /{owner}/{repo}/reviews[/{filter}]
  if (segments.length >= 2 && segments[1] === "reviews") {
    const repo = segments[0];
    const filter = (segments[2] ?? "requested") as ReviewsFilter;
    return <ReviewsView owner={owner} repo={repo} filter={filter} />;
  }

  // Pull requests: /{owner}/{repo}/pulls[/{filter|number|new}][/{subview}]
  if (segments.length >= 2 && segments[1] === "pulls") {
    const repo = segments[0];
    const seg2 = segments[2];

    // /pulls/new is the creation route (Plan 3 — not yet implemented)
    if (seg2 === "new") {
      return (
        <div className="p-4 md:p-6">
          <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            PR creation coming soon.
          </div>
        </div>
      );
    }

    // List view: /pulls (Open) or /pulls/{filter}
    const PULLS_LIST_FILTERS = new Set([
      "open",
      "mine",
      "assigned",
      "drafts",
      "closed",
      "merged",
    ]);
    if (seg2 === undefined || PULLS_LIST_FILTERS.has(seg2)) {
      const filter = (seg2 ?? "assigned") as PullsListFilter;
      return <PullsListView owner={owner} repo={repo} filter={filter} />;
    }

    // Detail view: /pulls/{number}[/diff|/checks]
    const prNumber = parseInt(seg2, 10);
    const subView = segments[3];

    if (subView === "diff") {
      return <DiffView owner={owner} repo={repo} prNumber={prNumber} />;
    }
    if (subView === "checks") {
      return <ChecksView owner={owner} repo={repo} prNumber={prNumber} />;
    }
    return <PullsView owner={owner} repo={repo} prNumber={prNumber} />;
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
