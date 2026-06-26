import { NavTree } from "@/components/nav-tree";
import { NavUser } from "@/components/nav-user";
import { OwnerSwitcher } from "@/components/owner-switcher";
import { Sidebar, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import type { Owner, Repo } from "@/lib/github";

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
  return (
    <Sidebar variant="inset">
      <SidebarHeader className="pt-px">
        <OwnerSwitcher owners={owners} activeOwner={activeOwner} />
      </SidebarHeader>
      <NavTree repos={repos} />
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
