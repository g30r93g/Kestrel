"use client";

import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * Inline, searchable picker that replaces the nav tree when a sidebar switcher
 * is toggled open.
 *
 * Pattern: a sidebar switcher exposes a toggle trigger (with an active state)
 * plus a `*List` built from `NavPicker` / `NavPickerGroup` / `NavPickerItem`.
 * `AppSidebar` owns a single `panel` value so the switchers are mutually
 * exclusive, and passes `onNavigate` (which closes the panel) to each list.
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
    <Command className="bg-transparent">
      <CommandInput placeholder={placeholder} autoFocus />
      <CommandList>
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
  onNavigate,
  children,
}: {
  value: string;
  href: string;
  active?: boolean;
  onNavigate: () => void;
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
      className="gap-2"
    >
      {children}
    </CommandItem>
  );
}
