"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { Owner } from "@/lib/github";

export function OwnerSwitcher({ owners, activeOwner }: { owners: Owner[]; activeOwner: string }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [metaHeld, setMetaHeld] = useState(false);

  const active = owners.find((o) => o.login === activeOwner) ?? owners[0];

  const user = useMemo(() => owners.find((o) => o.type === "user"), [owners]);
  const orgs = useMemo(() => owners.filter((o) => o.type === "org"), [owners]);
  // Order for the ⌘+number shortcuts: user first, then orgs.
  const ordered = useMemo(() => (user ? [user, ...orgs] : orgs), [user, orgs]);

  // While the menu is open, holding Meta reveals number hints; pressing
  // Meta+digit jumps to that owner.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        setMetaHeld(true);
        return;
      }
      if (e.metaKey && /^[1-9]$/.test(e.key)) {
        const target = ordered[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          setOpen(false);
          router.push(`/${target.login}`);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") setMetaHeld(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [open, ordered, router]);

  if (!active) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setMetaHeld(false);
  };

  const renderOwner = (owner: Owner, index: number) => (
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
      {metaHeld && index < 9 && <DropdownMenuShortcut>{index + 1}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={handleOpenChange}>
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
            {user && <DropdownMenuGroup>{renderOwner(user, 0)}</DropdownMenuGroup>}
            {orgs.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Organizations
                  </DropdownMenuLabel>
                  {orgs.map((org, i) => renderOwner(org, (user ? 1 : 0) + i))}
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
