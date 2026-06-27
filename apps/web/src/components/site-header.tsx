"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { PRSwitcher } from "@/components/pulls/pr-switcher";
import { RefSelector } from "@/components/ref-selector";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Command, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isCodeTab = /\/[^/]+\/[^/]+\/code(\/|$)/.test(pathname);
  // Show PRSwitcher on /pulls and /pulls/{number} but not /pulls/new (creation route)
  const isPullsTab = /\/[^/]+\/[^/]+\/pulls(\/\d+.*|$)/.test(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        {isCodeTab && <RefSelector />}
        {isPullsTab && <PRSwitcher />}
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
