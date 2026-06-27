"use client";

import type { PRComment } from "@/lib/github/types";

export interface ZoneConversationProps {
  comments: PRComment[];
  loading: boolean;
  error: boolean;
}

export function ZoneConversation(_props: ZoneConversationProps) {
  return null;
}
