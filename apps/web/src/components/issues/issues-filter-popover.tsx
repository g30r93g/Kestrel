"use client";

import { useState } from "react";
import { Check, ChevronRight, ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { IssueFilters } from "@/lib/github/types";

interface IssuesFilterPopoverProps {
  filters: IssueFilters;
  onChange: (filters: IssueFilters) => void;
  availableLabels: string[];
  availableAssignees: string[];
  availableMilestones: string[];
  availableAuthors: string[];
}

function activeCount(filters: IssueFilters): number {
  return (
    filters.labels.length +
    (filters.assignee ? 1 : 0) +
    (filters.milestone ? 1 : 0) +
    (filters.author ? 1 : 0)
  );
}

interface AxisPopoverProps {
  label: string;
  badge: number | undefined;
  children: React.ReactNode;
}

function AxisRow({ label, badge, children }: AxisPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            className={cn(
              "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted/50",
              badge && "font-medium",
            )}
          />
        }
      >
        <span>{label}</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          {badge != null && badge > 0 && (
            <span className="text-xs">·{badge}</span>
          )}
          <ChevronRight className="size-4" />
        </div>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-48 p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function IssuesFilterPopover({
  filters,
  onChange,
  availableLabels,
  availableAssignees,
  availableMilestones,
  availableAuthors,
}: IssuesFilterPopoverProps) {
  const [l1Open, setL1Open] = useState(false);
  const count = activeCount(filters);

  const toggleLabel = (label: string) => {
    const next = filters.labels.includes(label)
      ? filters.labels.filter((l) => l !== label)
      : [...filters.labels, label];
    onChange({ ...filters, labels: next });
  };

  const setSingle = <K extends keyof Omit<IssueFilters, "labels">>(
    key: K,
    value: string,
  ) => {
    onChange({ ...filters, [key]: filters[key] === value ? null : value });
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={l1Open} onOpenChange={setL1Open}>
        <PopoverTrigger
          render={<Button variant="ghost" size="sm" className="gap-1.5" />}
        >
          <ListFilter className="size-4" />
          Filters
          {count > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {count}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-44 p-1">
          <AxisRow label="Label" badge={filters.labels.length || undefined}>
            <Command>
              <CommandInput placeholder="Filter by label…" />
              <CommandList>
                <CommandEmpty>No labels.</CommandEmpty>
                <CommandGroup>
                  {availableLabels.map((l) => (
                    <CommandItem key={l} value={l} onSelect={() => toggleLabel(l)}>
                      {filters.labels.includes(l) && (
                        <Check className="mr-2 size-4 shrink-0" />
                      )}
                      {l}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </AxisRow>

          <AxisRow label="Assignee" badge={filters.assignee ? 1 : undefined}>
            <Command>
              <CommandInput placeholder="Filter by assignee…" />
              <CommandList>
                <CommandEmpty>No assignees.</CommandEmpty>
                <CommandGroup>
                  {availableAssignees.map((a) => (
                    <CommandItem key={a} value={a} onSelect={() => setSingle("assignee", a)}>
                      {filters.assignee === a && (
                        <Check className="mr-2 size-4 shrink-0" />
                      )}
                      {a}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </AxisRow>

          <AxisRow label="Milestone" badge={filters.milestone ? 1 : undefined}>
            <Command>
              <CommandInput placeholder="Filter by milestone…" />
              <CommandList>
                <CommandEmpty>No milestones.</CommandEmpty>
                <CommandGroup>
                  {availableMilestones.map((m) => (
                    <CommandItem key={m} value={m} onSelect={() => setSingle("milestone", m)}>
                      {filters.milestone === m && (
                        <Check className="mr-2 size-4 shrink-0" />
                      )}
                      {m}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </AxisRow>

          <AxisRow label="Author" badge={filters.author ? 1 : undefined}>
            <Command>
              <CommandInput placeholder="Filter by author…" />
              <CommandList>
                <CommandEmpty>No authors.</CommandEmpty>
                <CommandGroup>
                  {availableAuthors.map((a) => (
                    <CommandItem key={a} value={a} onSelect={() => setSingle("author", a)}>
                      {filters.author === a && (
                        <Check className="mr-2 size-4 shrink-0" />
                      )}
                      {a}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </AxisRow>
        </PopoverContent>
      </Popover>

      {count > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() =>
            onChange({ labels: [], assignee: null, milestone: null, author: null })
          }
        >
          <X className="size-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
