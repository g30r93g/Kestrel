"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { type NavNode, nodeHref, resolveNav } from "@/lib/nav-tree";

export function NavTree() {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const owner = params.owner;
  const segments = params.rest ?? [];
  const model = resolveNav(owner, segments);

  const renderNode = (node: NavNode) => {
    const Icon = node.icon;
    const isActive = model.activeId === node.id;
    return (
      <SidebarMenuItem key={node.id}>
        <SidebarMenuButton render={<Link href={nodeHref(model.basePath, node)} />} isActive={isActive} tooltip={node.label}>
          <Icon />
          <span>{node.label}</span>
          {node.badge ? <span className="ml-auto text-xs text-muted-foreground">{node.badge}</span> : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarContent>
      {model.back && (
        <SidebarMenu className="px-2 pt-2">
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href={model.back.href} />}>
              <ChevronLeft />
              <span>{model.back.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      )}

      {model.header && (
        <div className="flex items-center gap-2 px-4 py-1 text-sm font-medium">
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
    </SidebarContent>
  );
}
