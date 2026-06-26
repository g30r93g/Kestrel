"use client";

import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { Owner } from "@/lib/github";

export function OwnerSwitcher({ owners, activeOwner }: { owners: Owner[]; activeOwner: string }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const active = owners.find((o) => o.login === activeOwner) ?? owners[0];
  if (!active) return null;

  const user = owners.find((o) => o.type === "user");
  const orgs = owners.filter((o) => o.type === "org");

  const renderOwner = (owner: Owner) => (
    <DropdownMenuItem
      key={owner.login}
      className="gap-2 p-2"
      onClick={() => router.push(`/${owner.login}`)}
    >
      <Avatar className="size-6 rounded-md">
        <AvatarImage src={owner.avatarUrl} alt={owner.login} />
        <AvatarFallback className="rounded-md">{owner.login.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      {owner.login}
    </DropdownMenuItem>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="data-[popup-open]:bg-sidebar-accent" />}>
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={active.avatarUrl} alt={active.login} />
              <AvatarFallback className="rounded-lg">{active.login.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{active.login}</span>
              <span className="truncate text-xs text-muted-foreground">
                {active.type === "user" ? "Personal" : "Organization"}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {user && <DropdownMenuGroup>{renderOwner(user)}</DropdownMenuGroup>}
            {orgs.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Organizations
                  </DropdownMenuLabel>
                  {orgs.map(renderOwner)}
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
