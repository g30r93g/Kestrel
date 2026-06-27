"use client";

import { useState, useMemo } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { fetchCollaborators } from "@/lib/github/pulls";
import { requestReview } from "@/lib/github/pulls-actions";
import type { PRCollaborator } from "@/lib/github/types";
import { cn } from "@/lib/utils";
import useSWR from "swr";

interface CollaboratorSelectorProps {
  owner: string;
  repo: string;
  prNumber: number;
  onSuccess: () => void;
}

export function CollaboratorSelector({
  owner,
  repo,
  prNumber,
  onSuccess,
}: CollaboratorSelectorProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data: collaborators = [], isLoading } = useSWR(
    [owner, repo, "collaborators"],
    ([o, r]: [string, string, string]) => fetchCollaborators(o, r),
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return collaborators;
    return collaborators.filter((c) => c.login.toLowerCase().includes(q));
  }, [collaborators, query]);

  const toggle = (login: string) => {
    setSelected((prev) =>
      prev.includes(login) ? prev.filter((l) => l !== login) : [...prev, login],
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await requestReview(owner, repo, prNumber, selected);
    setSubmitting(false);
    if (result.success) {
      setSelected([]);
      setOpen(false);
      onSuccess();
    } else {
      setSubmitError(result.error ?? "Request failed");
    }
  };

  return (
    <div className="space-y-2">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {selected.length === 0
            ? "Select reviewers…"
            : `${selected.length} selected`}
          <ChevronDown className="size-3.5 ml-1 shrink-0" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={4}>
            <Popover.Popup className="z-50 w-64 rounded-lg border bg-popover shadow-lg outline-none">
              {/* Search */}
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search collaborators…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-52 overflow-y-auto py-1">
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!isLoading && filtered.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {query ? "No collaborators match." : "No collaborators found."}
                  </p>
                )}
                {filtered.map((c: PRCollaborator) => {
                  const isSelected = selected.includes(c.login);
                  return (
                    <button
                      key={c.login}
                      onClick={() => toggle(c.login)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                        isSelected && "bg-muted/60",
                      )}
                    >
                      <img
                        src={c.avatarUrl}
                        alt={c.login}
                        className="size-5 rounded-full"
                      />
                      <span className="flex-1 truncate text-left">{c.login}</span>
                      {isSelected && (
                        <Check className="size-3.5 shrink-0 text-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((login) => (
            <span
              key={login}
              className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              {login}
              <button
                onClick={() => toggle(login)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {submitError && (
        <p className="text-xs text-destructive">{submitError}</p>
      )}

      {selected.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background disabled:opacity-50 hover:opacity-80 transition-opacity"
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          Request {selected.length} reviewer{selected.length > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
