"use client";

import useSWR from "swr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Circle, CircleCheck, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchIssueDetail, fetchIssueComments } from "@/lib/github/issues";
import { formatTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Issue, IssueComment } from "@/lib/github/types";

function IssueHeader({ issue }: { issue: Issue }) {
  const isOpen = issue.state === "open";
  return (
    <div className="shrink-0 border-b px-4 py-3">
      <h1 className="text-base font-semibold leading-snug">{issue.title}</h1>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
            isOpen
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
          )}
        >
          {isOpen ? (
            <Circle className="size-3" />
          ) : (
            <CircleCheck className="size-3" />
          )}
          {isOpen ? "Open" : "Closed"}
        </span>
        <span className="text-muted-foreground">
          #{issue.number} · opened {formatTimeAgo(issue.createdAt)} by{" "}
          <span className="font-medium text-foreground">{issue.user.login}</span>
        </span>
      </div>
    </div>
  );
}

function MetaSidebar({ issue }: { issue: Issue }) {
  const hasContent =
    issue.labels.length > 0 || issue.assignees.length > 0 || issue.milestone != null;
  if (!hasContent) return null;

  return (
    <aside className="w-44 shrink-0 space-y-4 text-xs">
      {issue.labels.length > 0 && (
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Labels</p>
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <span
                key={label.name}
                className="rounded-full px-1.5 py-0.5 font-medium"
                style={{
                  backgroundColor: `#${label.color}33`,
                  color: `#${label.color}`,
                  border: `1px solid #${label.color}55`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {issue.assignees.length > 0 && (
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Assignees</p>
          <div className="space-y-1.5">
            {issue.assignees.map((a) => (
              <div key={a.login} className="flex items-center gap-1.5">
                <Avatar size="sm">
                  <AvatarImage src={a.avatarUrl} alt={a.login} />
                  <AvatarFallback>{a.login[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground">{a.login}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {issue.milestone && (
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Milestone</p>
          <p className="text-muted-foreground">{issue.milestone.title}</p>
        </div>
      )}
    </aside>
  );
}

function CommentCard({ comment }: { comment: IssueComment }) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <Avatar size="sm">
          <AvatarImage src={comment.user.avatarUrl} alt={comment.user.login} />
          <AvatarFallback>{comment.user.login[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{comment.user.login}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(comment.createdAt)}
        </span>
      </div>
      <div className="px-3 py-3">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

export function IssueDetail({
  owner,
  repo,
  issueNumber,
}: {
  owner: string;
  repo: string;
  issueNumber: number;
}) {
  const { data: issue, isLoading: issueLoading } = useSWR(
    ["issue", owner, repo, issueNumber],
    () => fetchIssueDetail(owner, repo, issueNumber),
  );

  const { data: comments = [], isLoading: commentsLoading } = useSWR(
    ["issue-comments", owner, repo, issueNumber],
    () => fetchIssueComments(owner, repo, issueNumber),
  );

  if (issueLoading) return <DetailSkeleton />;
  if (!issue) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Issue not found.
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <IssueHeader issue={issue} />
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-6 p-4">
          {/* Body + comments */}
          <div className="min-w-0 flex-1">
            {issue.body ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {issue.body}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No description provided.
              </p>
            )}

            {issue.commentCount > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="size-4" />
                  {issue.commentCount} Comment
                  {issue.commentCount !== 1 ? "s" : ""}
                </div>
                {commentsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <CommentCard key={comment.id} comment={comment} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata sidebar */}
          <MetaSidebar issue={issue} />
        </div>
      </div>
    </div>
  );
}
