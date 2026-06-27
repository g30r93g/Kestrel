"use client";

import type { PullRequest } from "@/lib/github/types";

export interface ZoneIdentityProps {
  pr: PullRequest | null;
  loading: boolean;
  error: boolean;
}

export function ZoneIdentity(_props: ZoneIdentityProps) {
  return null;
}
