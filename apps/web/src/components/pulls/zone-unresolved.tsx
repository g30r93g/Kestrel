"use client";

import type { PRThread } from "@/lib/github/types";

export interface ZoneUnresolvedProps {
  threads: PRThread[];
  loading: boolean;
  error: boolean;
}

export function ZoneUnresolved(_props: ZoneUnresolvedProps) {
  return null;
}
