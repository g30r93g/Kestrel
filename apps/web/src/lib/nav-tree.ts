import {
  AtSign,
  CircleCheck,
  CircleDot,
  Code,
  Eye,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  House,
  LayoutDashboard,
  LayoutGrid,
  Package,
  Settings,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavNode {
  id: string;
  label: string;
  icon: LucideIcon;
  kind: "leaf" | "drill";
  /** URL segment relative to the current base; "" means the base itself. */
  segment: string;
  badge?: number;
  children?: NavNode[];
}

export interface NavGroup {
  id: string;
  label?: string;
  nodes: NavNode[];
}

export interface NavRenderModel {
  context: "owner" | "repo";
  groups: NavGroup[];
  pinned?: NavNode;
  back?: { label: string; href: string };
  header?: { label: string; icon: LucideIcon };
  activeId?: string;
  basePath: string;
}

const leaf = (id: string, label: string, icon: LucideIcon, segment = id): NavNode => ({
  id, label, icon, kind: "leaf", segment,
});
const drill = (
  id: string, label: string, icon: LucideIcon, children: NavNode[], badge?: number,
): NavNode => ({ id, label, icon, kind: "drill", segment: id, badge, children });

// ─── Owner root (attention-first) ───────────────────────────────────────────
export const ownerRootGroups: NavGroup[] = [
  {
    id: "attention",
    nodes: [
      leaf("home", "Home", House, ""),
      drill("review", "Needs my review", Eye, [
        leaf("all", "All", Eye, ""),
        leaf("direct", "Requested directly", Eye),
        leaf("oldest", "Oldest first", Eye),
      ], 4),
      drill("pulls", "My pull requests", GitPullRequest, [
        leaf("open", "Open", GitPullRequest, ""),
        leaf("merged", "Merged", GitPullRequest),
        leaf("drafts", "Drafts", GitPullRequest),
      ], 7),
      drill("assigned", "Assigned issues", CircleDot, [
        leaf("open", "Open", CircleDot, ""),
        leaf("closed", "Closed", CircleDot),
      ], 3),
      drill("mentions", "Mentions", AtSign, [
        leaf("unread", "Unread", AtSign, ""),
        leaf("all", "All", AtSign),
      ]),
      drill("checks", "Failing checks", CircleCheck, [
        leaf("mine", "My PRs", CircleCheck, ""),
        leaf("all", "All", CircleCheck),
      ], 2),
    ],
  },
  {
    id: "places",
    nodes: [
      leaf("repositories", "Repositories", FolderGit2),
      leaf("projects", "Projects", LayoutGrid),
      leaf("teams", "Teams", Users),
    ],
  },
];

// ─── Repo (grouped by domain) ────────────────────────────────────────────────
export const repoGroups: NavGroup[] = [
  {
    id: "source",
    nodes: [
      leaf("overview", "Overview", LayoutDashboard, ""),
      leaf("code", "Code", Code),
      drill("branches", "Branches", GitBranch, [
        leaf("all", "All", GitBranch, ""),
        leaf("yours", "Yours", GitBranch),
        leaf("active", "Active", GitBranch),
        leaf("stale", "Stale", GitBranch),
      ]),
      leaf("releases", "Tags & Releases", Tag),
      leaf("packages", "Packages", Package),
    ],
  },
  {
    id: "work",
    nodes: [
      drill("reviews", "Reviews", Eye, [
        leaf("requested", "Requested", Eye, ""),
        leaf("done", "Done", Eye),
      ], 2),
      drill("pulls", "Pull requests", GitPullRequest, [
        leaf("open", "Open", GitPullRequest, ""),
        leaf("yours", "Yours", GitPullRequest),
        leaf("requested", "Review requests", GitPullRequest),
        leaf("merged", "Merged", GitPullRequest),
        leaf("drafts", "Drafts", GitPullRequest),
      ], 5),
      leaf("issues", "Issues", CircleDot),
      drill("checks", "Checks", CircleCheck, [
        leaf("failing", "Failing", CircleCheck, ""),
        leaf("running", "Running", CircleCheck),
        leaf("all", "All", CircleCheck),
      ], 1),
    ],
  },
  {
    id: "community",
    nodes: [
      leaf("people", "People", Users),
      leaf("projects", "Projects", LayoutGrid),
    ],
  },
];

export const settingsNode: NavNode = leaf("settings", "Settings", Settings);

// Reserved owner-level slugs (everything else after the owner is a repo name).
const ownerQueueIds = new Set(["review", "pulls", "assigned", "mentions", "checks"]);
const placeIds = new Set(["repositories", "projects", "teams"]);

function findTopNode(groups: NavGroup[], id: string): NavNode | undefined {
  for (const g of groups) {
    const n = g.nodes.find((x) => x.id === id);
    if (n) return n;
  }
  return undefined;
}

export function resolveNav(owner: string, segments: string[]): NavRenderModel {
  const ownerBase = `/${owner}`;

  if (segments.length === 0) {
    return { context: "owner", groups: ownerRootGroups, basePath: ownerBase };
  }

  const [seg0, seg1] = segments;

  // Owner-wide queue drilled into its sub-filters.
  if (ownerQueueIds.has(seg0)) {
    const queue = findTopNode(ownerRootGroups, seg0);
    if (queue?.kind === "drill") {
      return {
        context: "owner",
        back: { label: "Back", href: ownerBase },
        header: { label: queue.label, icon: queue.icon },
        groups: [{ id: queue.id, nodes: queue.children ?? [] }],
        activeId: seg1,
        basePath: `${ownerBase}/${seg0}`,
      };
    }
  }

  // Place leaf → content list; sidebar stays at owner root, place active.
  if (placeIds.has(seg0)) {
    return { context: "owner", groups: ownerRootGroups, activeId: seg0, basePath: ownerBase };
  }

  // Otherwise seg0 is a repo name → repo context.
  const repoBase = `/${owner}/${seg0}`;
  if (segments.length === 1) {
    return { context: "repo", groups: repoGroups, pinned: settingsNode, basePath: repoBase };
  }

  // Drilled into a repo node's sub-views.
  const node = findTopNode(repoGroups, seg1);
  if (node?.kind === "drill") {
    return {
      context: "repo",
      back: { label: "Back", href: repoBase },
      header: { label: node.label, icon: node.icon },
      groups: [{ id: node.id, nodes: node.children ?? [] }],
      pinned: settingsNode,
      activeId: segments[2],
      basePath: `${repoBase}/${seg1}`,
    };
  }

  // Repo leaf section (code, tags, settings, …) — repo root nav, section active.
  return { context: "repo", groups: repoGroups, pinned: settingsNode, activeId: seg1, basePath: repoBase };
}

/** Build the href for a node rendered under a given base path. */
export function nodeHref(basePath: string, node: NavNode): string {
  return node.segment ? `${basePath}/${node.segment}` : basePath;
}
