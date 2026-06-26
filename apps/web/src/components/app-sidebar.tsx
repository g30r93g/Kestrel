"use client";

import { NavTree } from "@/components/nav-tree";
import { NavUser } from "@/components/nav-user";
import { OwnerSwitcher } from "@/components/owner-switcher";
import { Sidebar, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { fetchOwners, fetchReposForOwner } from "@/lib/github/actions";
import { cn } from "@/lib/utils";
import { useState } from "react";
import useSWRImmutable from "swr/immutable";

type Panel = "none" | "owners" | "repos";

export function AppSidebar({
  activeOwner,
  user,
}: {
  activeOwner: string;
  user: { name: string; email: string; avatar: string };
}) {
  const [panel, setPanel] = useState<Panel>("none");
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? "none" : p));

  const { data: owners = [] } = useSWRImmutable("owners", fetchOwners);
  const { data: repos = [] } = useSWRImmutable(["repos", activeOwner], () =>
    fetchReposForOwner(activeOwner),
  );

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
