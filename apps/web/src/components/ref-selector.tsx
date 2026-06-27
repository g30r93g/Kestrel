"use client";

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
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchBranches } from "@/lib/github/branches";
import { fetchTagNames } from "@/lib/github/tags-and-releases";
import { ChevronsUpDown, GitBranch, Tag } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Owner-level slugs that aren't repos, mirrored from the nav resolver.
const RESERVED = new Set([
  "review",
  "pulls",
  "assigned",
  "mentions",
  "checks",
  "repositories",
  "projects",
  "teams",
]);

type Mode = "branches" | "tags";

export function RefSelector() {
  const params = useParams<{ owner: string; rest?: string[] }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const owner = params.owner;
  const first = params.rest?.[0];
  const repo = first && !RESERVED.has(first) ? first : undefined;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("branches");
  const [selectedKind, setSelectedKind] = useState<Mode>("branches");

  const [branches, setBranches] = useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = useState("");

  const [tags, setTags] = useState<string[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);

  useEffect(() => {
    if (!owner || !repo) return;
    let cancelled = false;
    fetchBranches(owner, repo).then((res) => {
      if (cancelled) return;
      setBranches(res.branches);
      setDefaultBranch(res.defaultBranch);
    });
    return () => { cancelled = true; };
  }, [owner, repo]);

  useEffect(() => {
    if (!owner || !repo || mode !== "tags" || tagsLoaded) return;
    let cancelled = false;
    fetchTagNames(owner, repo).then((names) => {
      if (cancelled) return;
      setTags(names);
      setTagsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [owner, repo, mode, tagsLoaded]);

  if (!repo) return null;

  const currentRef = searchParams.get("ref") ?? defaultBranch;
  const items = mode === "branches" ? branches : tags;

  const select = (ref: string) => {
    setOpen(false);
    setSelectedKind(mode);
    const next = new URLSearchParams(searchParams.toString());
    if (mode === "branches" && ref === defaultBranch) next.delete("ref");
    else next.set("ref", ref);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const TriggerIcon = selectedKind === "tags" ? Tag : GitBranch;

  return (
    <>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="sm" className="gap-2 font-medium" />}>
          <TriggerIcon className="size-4 shrink-0" />
          <span className="max-w-40 truncate">
            {currentRef || (selectedKind === "tags" ? "Tag" : "Branch")}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>

        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <div className="flex items-center justify-center border-b px-3 py-2">
              <TooltipProvider>
                <ToggleGroup size="sm" variant="outline">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <ToggleGroupItem
                          pressed={mode === "branches"}
                          onPressedChange={(pressed) => {
                            if (pressed) setMode("branches");
                          }}
                        />
                      }
                    >
                      <GitBranch className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>Branches</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <ToggleGroupItem
                          pressed={mode === "tags"}
                          onPressedChange={(pressed) => {
                            if (pressed) setMode("tags");
                          }}
                        />
                      }
                    >
                      <Tag className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>Tags</TooltipContent>
                  </Tooltip>
                </ToggleGroup>
              </TooltipProvider>
            </div>

            <CommandInput
              placeholder={mode === "branches" ? "Search branches…" : "Search tags…"}
            />
            <CommandList>
              <CommandEmpty>
                {mode === "branches" ? "No branch found." : "No tag found."}
              </CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item}
                    value={item}
                    data-checked={item === currentRef ? "true" : undefined}
                    onSelect={() => select(item)}
                  >
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
