"use client";

import type { VerdictState } from "@/lib/github/types";

export interface ZoneVerdictProps {
  verdict: VerdictState | null;
  loading: boolean;
  error: boolean;
}

export function ZoneVerdict(_props: ZoneVerdictProps) {
  return null;
}
