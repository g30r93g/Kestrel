"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Shared entrance animation for sidebar nav rows (fade + slide up). Used by the tree. */
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

/**
 * A navigable picker item; shows a check when `active` and closes on select.
 *
 * The entrance (fade + slide up) is driven by motion on an inner element so it
 * runs once on mount: it neither replays when cmdk shows/hides rows during a
 * search, nor leaves a transform-teardown snap when it settles.
 */
export function NavPickerItem({
  value,
  href,
  active,
  index = 0,
  onNavigate,
  action,
  children,
}: {
  value: string;
  href: string;
  active?: boolean;
  index?: number;
  onNavigate: () => void;
  /** Optional trailing control (e.g. a pin toggle); should stop its own events. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <CommandItem
      value={value}
      data-checked={active ? "true" : undefined}
      onSelect={() => {
        onNavigate();
        router.push(href);
      }}
      className="group/nav-item gap-2"
    >
      <motion.span
        className="flex flex-1 items-center gap-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: Math.min(index, 12) * 0.01 }}
      >
        {children}
      </motion.span>
      {action}
    </CommandItem>
  );
}
