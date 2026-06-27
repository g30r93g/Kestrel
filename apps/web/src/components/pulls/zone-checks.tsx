"use client";

import type { PRCheckRun } from "@/lib/github/types";

export interface ZoneChecksProps {
  checks: PRCheckRun[];
  loading: boolean;
  error: boolean;
}

export function ZoneChecks(_props: ZoneChecksProps) {
  return null;
}
