"use client";

import type { PRReview } from "@/lib/github/types";

export interface ZoneReviewsProps {
  reviews: PRReview[];
  loading: boolean;
  error: boolean;
}

export function ZoneReviews(_props: ZoneReviewsProps) {
  return null;
}
