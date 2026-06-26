"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/** Shared entrance animation for sidebar nav/picker rows (fade + slide up). */
export const NAV_ITEM_ENTER =
  "duration-300 animate-in fade-in fill-mode-both slide-in-from-bottom-2";

/** Per-row stagger step, capped so long lists don't cascade forever. */
export const navItemDelay = (index: number) => `${Math.min(index, 12) * 10}ms`;

/**
 * Inline, searchable picker that replaces the nav tree when a sidebar switcher
 * is toggled open. Pair with a toggle trigger and a panel value in AppSidebar.
 */
export function NavPicker({
  placeholder,
  emptyText,
  children,
}: {
  placeholder: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Command className="flex-1 bg-transparent">
      <div className="duration-300 animate-in fade-in fill-mode-both">
        <CommandInput placeholder={placeholder} autoFocus />
      </div>
      <CommandList className="max-h-none min-h-0 flex-1">
        <CommandEmpty>{emptyText}</CommandEmpty>
        {children}
      </CommandList>
    </Command>
  );
}

/** A group of picker items, optionally with a `heading`. */
export { CommandGroup as NavPickerGroup };

/** A navigable picker item; shows a check when `active` and closes on select. */
export function NavPickerItem({
  value,
  href,
  active,
  index = 0,
  onNavigate,
  children,
}: {
  value: string;
  href: string;
  active?: boolean;
  index?: number;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Animate only on first mount, then drop the class so cmdk's show/hide while
  // filtering the search query doesn't retrigger the entrance animation.
  const [entering, setEntering] = useState(true);

  return (
    <CommandItem
      value={value}
      data-checked={active ? "true" : undefined}
      onSelect={() => {
        onNavigate();
        router.push(href);
      }}
      onAnimationEnd={() => setEntering(false)}
      className={cn("gap-2", entering && NAV_ITEM_ENTER)}
      style={entering ? { animationDelay: navItemDelay(index) } : undefined}
    >
      {children}
    </CommandItem>
  );
}
