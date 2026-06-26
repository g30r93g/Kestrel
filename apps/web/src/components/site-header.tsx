import { Bell, Command, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { RepoSwitcher } from "@/components/repo-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import type { Repo } from "@/lib/github";

export function SiteHeader({
  owner,
  repos,
}: {
  owner: string;
  repos: Repo[];
}) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
        <RepoSwitcher owner={owner} repos={repos} />
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
