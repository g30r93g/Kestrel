"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PendingReviewComment, ReviewDraft } from "@/lib/github/types";

interface ReviewDraftContextValue {
  draft: ReviewDraft;
  addComment: (comment: Omit<PendingReviewComment, "id">) => void;
  updateComment: (id: string, body: string) => void;
  removeComment: (id: string) => void;
  toggleFile: (filename: string) => void;
  setBody: (body: string) => void;
  clearDraft: () => void;
}

const ReviewDraftContext = createContext<ReviewDraftContextValue | null>(null);

const EMPTY: ReviewDraft = { commitSha: "", comments: [], markedFiles: [], body: "" };

function storageKey(owner: string, repo: string, prNumber: number) {
  return `review-draft:${owner}/${repo}/${prNumber}`;
}

function readDraft(key: string, commitSha: string): ReviewDraft {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...EMPTY, commitSha };
    const parsed = JSON.parse(raw) as ReviewDraft;
    if (parsed.commitSha !== commitSha) return { ...EMPTY, commitSha };
    return parsed;
  } catch {
    return { ...EMPTY, commitSha };
  }
}

function writeDraft(key: string, draft: ReviewDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // SSR or private-mode quota exceeded
  }
}

interface ReviewDraftProviderProps {
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
  enabled: boolean;
  children: React.ReactNode;
}

export function ReviewDraftProvider({
  owner,
  repo,
  prNumber,
  commitSha,
  enabled,
  children,
}: ReviewDraftProviderProps) {
  const key = storageKey(owner, repo, prNumber);

  const [draft, setDraft] = useState<ReviewDraft>(() =>
    typeof window !== "undefined" && commitSha
      ? readDraft(key, commitSha)
      : { ...EMPTY, commitSha },
  );

  const prevCommitSha = useRef(commitSha);
  useEffect(() => {
    if (commitSha && commitSha !== prevCommitSha.current) {
      prevCommitSha.current = commitSha;
      setDraft(readDraft(key, commitSha));
    }
  }, [commitSha, key]);

  const update = useCallback(
    (updater: (prev: ReviewDraft) => ReviewDraft) => {
      setDraft((prev) => {
        const next = updater(prev);
        writeDraft(key, next);
        return next;
      });
    },
    [key],
  );

  const addComment = useCallback(
    (comment: Omit<PendingReviewComment, "id">) => {
      update((prev) => ({
        ...prev,
        comments: [...prev.comments, { ...comment, id: crypto.randomUUID() }],
      }));
    },
    [update],
  );

  const updateComment = useCallback(
    (id: string, body: string) => {
      update((prev) => ({
        ...prev,
        comments: prev.comments.map((c) => (c.id === id ? { ...c, body } : c)),
      }));
    },
    [update],
  );

  const removeComment = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        comments: prev.comments.filter((c) => c.id !== id),
      }));
    },
    [update],
  );

  const toggleFile = useCallback(
    (filename: string) => {
      update((prev) => ({
        ...prev,
        markedFiles: prev.markedFiles.includes(filename)
          ? prev.markedFiles.filter((f) => f !== filename)
          : [...prev.markedFiles, filename],
      }));
    },
    [update],
  );

  const setBody = useCallback(
    (body: string) => update((prev) => ({ ...prev, body })),
    [update],
  );

  const clearDraft = useCallback(() => {
    const fresh = { ...EMPTY, commitSha };
    writeDraft(key, fresh);
    setDraft(fresh);
  }, [key, commitSha]);

  const value = useMemo<ReviewDraftContextValue>(
    () => ({ draft, addComment, updateComment, removeComment, toggleFile, setBody, clearDraft }),
    [draft, addComment, updateComment, removeComment, toggleFile, setBody, clearDraft],
  );

  if (!enabled) return <>{children}</>;
  return <ReviewDraftContext.Provider value={value}>{children}</ReviewDraftContext.Provider>;
}

export function useReviewDraft(): ReviewDraftContextValue {
  const ctx = useContext(ReviewDraftContext);
  if (!ctx) throw new Error("useReviewDraft must be used within ReviewDraftProvider");
  return ctx;
}
