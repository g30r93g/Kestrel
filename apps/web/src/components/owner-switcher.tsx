"use client";

import { ChevronsUpDown } from "lucide-react";
import { NavPicker, NavPickerGroup, NavPickerItem } from "@/components/nav-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Owner } from "@/lib/github";

// The owner trigger in the sidebar header. Toggles the inline owner list;
// shows an active state while the list is open.
export function OwnerSwitcher({
  owners,
  activeOwner,
  open,
  onToggle,
}: {
  owners: Owner[];
  activeOwner: string;
  open: boolean;
  onToggle: () => void;
}) {
  const active = owners.find((o) => o.login === activeOwner) ?? owners[0];
  if (!active) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          onClick={onToggle}
          aria-expanded={open}
          className={cn(open && "bg-sidebar-accent text-sidebar-accent-foreground")}
        >
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
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function OwnerAvatar({ owner }: { owner: Owner }) {
  return (
    <Avatar className="size-6 rounded-md">
      <AvatarImage src={owner.avatarUrl} alt={owner.login} />
      <AvatarFallback className="rounded-md">{owner.login.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

// Inline searchable owner list that replaces the nav tree while picking.
export function OwnerList({
  owners,
  activeOwner,
  onNavigate,
}: {
  owners: Owner[];
  activeOwner: string;
  onNavigate: () => void;
}) {
  const user = owners.find((o) => o.type === "user");
  const orgs = owners.filter((o) => o.type === "org");

  return (
    <NavPicker placeholder="Search owners…" emptyText="No owner found.">
      {user && (
        <NavPickerGroup>
          <NavPickerItem
            index={0}
            value={user.login}
            href={`/${user.login}`}
            active={activeOwner === user.login}
            onNavigate={onNavigate}
          >
            <OwnerAvatar owner={user} />
            {user.login}
          </NavPickerItem>
        </NavPickerGroup>
      )}
      {orgs.length > 0 && (
        <NavPickerGroup heading="Organizations">
          {orgs.map((org, i) => (
            <NavPickerItem
              key={org.login}
              index={(user ? 1 : 0) + i}
              value={org.login}
              href={`/${org.login}`}
              active={activeOwner === org.login}
              onNavigate={onNavigate}
            >
              <OwnerAvatar owner={org} />
              {org.login}
            </NavPickerItem>
          ))}
        </NavPickerGroup>
      )}
    </NavPicker>
  );
}
