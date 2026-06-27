"use client";

import { usePathname } from "next/navigation";
import { Bell, Command, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BranchSelector } from "@/components/branch-selector";
import { ModeToggle } from "@/components/mode-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  const isCodeTab = /\/[^/]+\/[^/]+\/code(\/|$)/.test(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        {isCodeTab && <BranchSelector />}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Command palette"><Command className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Inbox"><Bell className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Create"><Plus className="size-4" /></Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
