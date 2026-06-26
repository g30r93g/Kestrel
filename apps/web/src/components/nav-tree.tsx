"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NAV_ITEM_ENTER, navItemDelay } from "@/components/nav-picker";
import { OwnerList } from "@/components/owner-switcher";
import { RepoList, RepoSwitcher } from "@/components/repo-switcher";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { Owner, Repo } from "@/lib/github";
import { type NavNode, nodeHref, resolveNav } from "@/lib/nav-tree";

type Panel = "none" | "owners" | "repos";

const EASE = [0.22, 1, 0.36, 1] as const;
const FADE_ENTER = "duration-300 animate-in fade-in fill-mode-both";

export function NavTree({
  repos,
  owners,
  panel,
  onToggleRepos,
  onClose,
}: {
  repos: Repo[];
  owners: Owner[];
  panel: Panel;
  onToggleRepos: () => void;
  onClose: () => void;
}) {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const segments = params.rest ?? [];
  const model = resolveNav(owner, segments);
  const activeRepo = model.context === "repo" ? segments[0] : undefined;

  // Running row index so tree items stagger up like the picker lists. They
  // mount (and animate) when the panel swaps back to the tree, e.g. after
  // switching repos/owners — not on in-place section navigation.
  let row = 0;
  const renderNode = (node: NavNode) => {
    const Icon = node.icon;
    const isActive = model.activeId === node.id;
    const delay = navItemDelay(row++);
    return (
      <SidebarMenuItem key={node.id}>
        <SidebarMenuButton
          render={<Link href={nodeHref(model.basePath, node)} />}
          isActive={isActive}
          tooltip={node.label}
          className={NAV_ITEM_ENTER}
          style={{ animationDelay: delay }}
        >
          <Icon />
          <span>{node.label}</span>
          {node.badge ? <span className="ml-auto text-xs text-muted-foreground">{node.badge}</span> : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const body =
    panel === "owners" ? (
      <OwnerList owners={owners} activeOwner={owner} onNavigate={onClose} />
    ) : panel === "repos" ? (
      <RepoList owner={owner} repos={repos} activeRepo={activeRepo} onNavigate={onClose} />
    ) : (
      <>
        {model.back && (
          <SidebarMenu className="px-2 pt-2">
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href={model.back.href} />} className={FADE_ENTER}>
                <ChevronLeft />
                <span>{model.back.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {model.header && (
          <div className={`flex items-center gap-2 px-4 py-1 text-sm font-medium ${FADE_ENTER}`}>
            <model.header.icon className="size-4" />
            {model.header.label}
          </div>
        )}

        {model.groups.map((group, i) => (
          <SidebarGroup key={group.id}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            {i > 0 && !group.label && <SidebarSeparator className="mb-1" />}
            <SidebarMenu>{group.nodes.map(renderNode)}</SidebarMenu>
          </SidebarGroup>
        ))}

        {model.pinned && (
          <SidebarGroup className="mt-auto">
            <SidebarSeparator className="mb-1" />
            <SidebarMenu>{renderNode(model.pinned)}</SidebarMenu>
          </SidebarGroup>
        )}
      </>
    );

  return (
    <SidebarContent className="overflow-x-hidden">
      <AnimatePresence initial={false}>
        {panel !== "owners" && (
          <motion.div
            key="repo-pill"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-3 pb-1">
              <RepoSwitcher
                label={activeRepo ?? "All repositories"}
                active={panel === "repos"}
                onToggle={onToggleRepos}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={panel}
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="flex min-h-0 flex-1 flex-col gap-2"
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </SidebarContent>
  );
}
