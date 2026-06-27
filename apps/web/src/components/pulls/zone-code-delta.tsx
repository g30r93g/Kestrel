"use client";

import type { PullRequest, PRFile } from "@/lib/github/types";

export interface ZoneCodeDeltaProps {
  pr: PullRequest | null;
  files: PRFile[];
  loading: boolean;
  error: boolean;
}

export function ZoneCodeDelta(_props: ZoneCodeDeltaProps) {
  return null;
}
