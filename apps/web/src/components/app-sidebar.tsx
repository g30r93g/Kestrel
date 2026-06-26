"use client";

import { NavTree } from "@/components/nav-tree";
import { NavUser } from "@/components/nav-user";
import { OwnerSwitcher } from "@/components/owner-switcher";
import { Sidebar, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import type { Owner, Repo } from "@/lib/github";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Panel = "none" | "owners" | "repos";

export function AppSidebar({
  owners,
  activeOwner,
  user,
  repos,
}: {
  owners: Owner[];
  activeOwner: string;
  user: { name: string; email: string; avatar: string };
  repos: Repo[];
}) {
  const [panel, setPanel] = useState<Panel>("none");
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? "none" : p));

  return (
    <Sidebar variant="inset">
      <SidebarHeader className={cn("pt-px px-0")}>
        <OwnerSwitcher
          owners={owners}
          activeOwner={activeOwner}
          open={panel === "owners"}
          onToggle={() => toggle("owners")}
        />
      </SidebarHeader>
      <NavTree
        repos={repos}
        owners={owners}
        panel={panel}
        onToggleRepos={() => toggle("repos")}
        onClose={() => setPanel("none")}
      />
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
