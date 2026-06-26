"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "kestrel:pinned-repos";

// Pinned repos are stored as a flat list of `owner/name` identities so pins are
// scoped per owner and survive across sessions via localStorage.
function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function usePinnedRepos() {
  const [pinned, setPinned] = useState<string[]>(read);

  const toggle = useCallback((key: string) => {
    setPinned((current) => {
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [key, ...current];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore write failures (e.g. storage disabled)
      }
      return next;
    });
  }, []);

  const isPinned = useCallback((key: string) => pinned.includes(key), [pinned]);

  return { isPinned, toggle };
}
