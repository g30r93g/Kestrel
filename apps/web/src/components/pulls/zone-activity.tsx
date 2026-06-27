"use client";

import type { PRActivity } from "@/lib/github/types";

export interface ZoneActivityProps {
  events: PRActivity[];
  loading: boolean;
  error: boolean;
}

export function ZoneActivity(_props: ZoneActivityProps) {
  return null;
}
