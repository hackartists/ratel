// app/ratel/src/features/spaces/pages/index/action_pages/discussion/hooks/use_discussion_arena.rs
// (`UseDiscussionArena`) — React counterpart, provided once per
// `DiscussionArenaPage` mount and consumed by `CommentItem` / `ReplyItem` /
// `CommentCardBody` the same way the Rust context is.
//
// Gaps (documented, not ported — see the file header of
// `../discussion-arena.tsx` for the full list): no 5s new-comment poll, no
// `sort_tick` time-decay re-sort interval. Comments are ranked by
// `commentScore` once per data change instead of continuously.
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listComments, listReplies } from "@ratel/ts-bridges";
import type { DiscussionCommentResponse, ReportReason, SpacePartition, SpacePostEntityType } from "@ratel/ts-bridges";
import {
  useAddComment,
  useBlockUser,
  useDeleteComment,
  useGetComment,
  useGetDiscussionDetail,
  useLikeComment,
  useListComments,
  useListSpaceMembers,
  useReplyComment,
  useReportComment,
  useSubscribeDiscussion,
  useUnsubscribeDiscussion,
  useUpdateComment,
} from "@ratel/ts-bridges/hooks";
import type { MentionCandidate } from "@/components/ui/mention-autocomplete";
import { buildMentionPriority } from "@/lib/mention";
import { useToast } from "@/lib/toast";

/** Rust `EntityType::SpacePostComment("x")` Display → bare id ("x"). */
export function bareCommentId(sk: string): string {
  const idx = sk.indexOf("#");
  return idx === -1 ? sk : sk.slice(idx + 1);
}

/** Rust `SpacePostCommentTargetEntityType::from_str` — strips the sk prefix
 * (top-level or reply) into the flat form the like/edit/delete/report
 * endpoints accept. Reply sks use `::` instead of the inner `#` because a
 * literal `#` in the URL path is treated as a fragment delimiter. */
export function toCommentTargetId(sk: string): string {
  const replyPrefix = "SPACE_POST_COMMENT_REPLY#";
  const topPrefix = "SPACE_POST_COMMENT#";
  if (sk.startsWith(replyPrefix)) return sk.slice(replyPrefix.length).replace("#", "::");
  if (sk.startsWith(topPrefix)) return sk.slice(topPrefix.length);
  return sk;
}

/** Rust `comment_score` — likes/replies log-scaled + freshness boost. */
export function commentScore(comment: DiscussionCommentResponse, nowSeconds: number): number {
  const likes = comment.likes;
  const replies = comment.replies;
  const likesTerm = Math.log10(likes + 1) * 3;
  const repliesTerm = Math.log10(replies + 1) * 5;
  const timeTerm = comment.created_at / 86400;
  const ageSeconds = Math.max(0, nowSeconds - comment.created_at);
  const ageHours = ageSeconds / 3600;
  const freshTerm = 4 * Math.exp(-ageHours);
  return likesTerm + repliesTerm + timeTerm + freshTerm;
}

/** Rust `merge_and_rank_comments` (without the polled-buffer merge — see gap note above). */
export function rankComments(items: DiscussionCommentResponse[], nowSeconds: number): DiscussionCommentResponse[] {
  return [...items].sort((a, b) => commentScore(b, nowSeconds) - commentScore(a, nowSeconds));
}

export interface UseDiscussionArena {
  spaceId: SpacePartition;
  discussionSk: SpacePostEntityType;
  disc: ReturnType<typeof useGetDiscussionDetail>["data"];
  discLoading: boolean;
  subscribed: boolean;
  togglingSubscription: boolean;
  toggleSubscription: () => void;
  comments: DiscussionCommentResponse[];
  commentsLoading: boolean;
  hasMoreComments: boolean;
  loadingMoreComments: boolean;
  loadMoreComments: () => void;
  activeReplyThread: string | null;
  setActiveReplyThread: (id: string | null) => void;
  sheetExpanded: boolean;
  setSheetExpanded: (open: boolean) => void;
  threadReplies: DiscussionCommentResponse[];
  loadThreadReplies: (parentBareId: string) => Promise<DiscussionCommentResponse[]>;
  parentComment: DiscussionCommentResponse | null;
  mentionQuery: string | null;
  setMentionQuery: (q: string | null) => void;
  members: MentionCandidate[];
  topPriority: string[];
  pendingMention: { displayName: string; userPk: string } | null;
  setPendingMention: (v: { displayName: string; userPk: string } | null) => void;
  replyRefreshTick: number;
  effectiveLiked: (c: DiscussionCommentResponse) => boolean;
  effectiveLikes: (c: DiscussionCommentResponse) => number;
  effectiveContent: (c: DiscussionCommentResponse) => string;
  isDeleted: (c: DiscussionCommentResponse) => boolean;
  isReported: (c: DiscussionCommentResponse) => boolean;
  isAuthorBlocked: (c: DiscussionCommentResponse) => boolean;
  likeComment: (skStr: string, next: boolean) => void;
  likePending: boolean;
  updateComment: (skStr: string, content: string) => void;
  deleteComment: (skStr: string) => void;
  addComment: (content: string, images: string[]) => void;
  replyComment: (parentSkStr: string, content: string, images: string[]) => void;
  reportComment: (skStr: string, reason: ReportReason, detail: string) => void;
  blockUser: (authorPk: string) => void;
}

const Ctx = React.createContext<UseDiscussionArena | null>(null);

export function useDiscussionArena(): UseDiscussionArena {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useDiscussionArena must be used under DiscussionArenaProvider");
  return ctx;
}

export function DiscussionArenaProvider({
  spaceId,
  discussionSk,
  children,
}: {
  spaceId: SpacePartition;
  discussionSk: SpacePostEntityType;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const discQuery = useGetDiscussionDetail(spaceId, discussionSk);
  const disc = discQuery.data;

  const [subscribedOverride, setSubscribedOverride] = React.useState<boolean | null>(null);
  const subscribed = subscribedOverride ?? disc?.subscribed ?? false;
  const subscribeMut = useSubscribeDiscussion();
  const unsubscribeMut = useUnsubscribeDiscussion();
  const toggleSubscription = () => {
    const was = subscribed;
    setSubscribedOverride(!was);
    const mut = was ? unsubscribeMut : subscribeMut;
    mut.mutate(
      { spaceId, discussionSk },
      {
        onError: (err) => {
          setSubscribedOverride(was);
          toast.error(err);
        },
      },
    );
  };

  const commentsQuery = useListComments(spaceId, discussionSk, null, null);
  // `listComments` isn't paginated through a scaffolded infinite hook yet;
  // page manually via the same bookmark contract (`ListResponse.bookmark`).
  const [pages, setPages] = React.useState<DiscussionCommentResponse[][]>([]);
  const [bookmark, setBookmark] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  React.useEffect(() => {
    if (commentsQuery.data) {
      setPages([commentsQuery.data.items]);
      setBookmark(commentsQuery.data.bookmark);
    }
  }, [commentsQuery.data]);
  const refreshComments = () => queryClient.invalidateQueries({ queryKey: ["listComments", spaceId, discussionSk, null, null] });
  const loadMoreComments = () => {
    if (!bookmark || loadingMore) return;
    setLoadingMore(true);
    listComments(spaceId, discussionSk, bookmark, null)
      .then((resp) => {
        setPages((prev) => [...prev, resp.items]);
        setBookmark(resp.bookmark);
      })
      .catch((err) => toast.error(err))
      .finally(() => setLoadingMore(false));
  };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const comments = React.useMemo(() => rankComments(pages.flat(), nowSeconds), [pages, nowSeconds]);

  const [activeReplyThread, setActiveReplyThread] = React.useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = React.useState(false);
  const [pendingMention, setPendingMention] = React.useState<{ displayName: string; userPk: string } | null>(null);
  const [replyRefreshTick, setReplyRefreshTick] = React.useState(0);

  const parentQuery = useGetComment(spaceId, discussionSk, activeReplyThread ?? "", {
    enabled: activeReplyThread !== null,
  });
  const parentComment = activeReplyThread ? parentQuery.data ?? null : null;

  const [threadReplies, setThreadReplies] = React.useState<DiscussionCommentResponse[]>([]);
  const loadThreadReplies = React.useCallback(
    async (parentBareId: string) => {
      const resp = await listReplies(spaceId, discussionSk, parentBareId, null);
      return resp.items;
    },
    [spaceId, discussionSk],
  );
  React.useEffect(() => {
    if (!activeReplyThread) {
      setThreadReplies([]);
      return;
    }
    let cancelled = false;
    loadThreadReplies(activeReplyThread).then((items) => {
      if (!cancelled) setThreadReplies(items);
    });
    return () => {
      cancelled = true;
    };
  }, [activeReplyThread, loadThreadReplies, replyRefreshTick]);

  const [mentionQueryRaw, setMentionQueryRaw] = React.useState<string | null>(null);
  const [mentionQuery, setMentionQueryDebounced] = React.useState<string | null>(null);
  React.useEffect(() => {
    const handle = setTimeout(() => setMentionQueryDebounced(mentionQueryRaw), 150);
    return () => clearTimeout(handle);
  }, [mentionQueryRaw]);
  const membersQuery = useListSpaceMembers(spaceId, null, mentionQuery, { enabled: mentionQuery !== null });
  const members: MentionCandidate[] = React.useMemo(
    () =>
      (membersQuery.data?.items ?? []).map((m) => ({
        userPk: m.user_id,
        displayName: m.display_name,
        username: m.username,
        profileUrl: m.profile_url,
      })),
    [membersQuery.data],
  );

  const topPriority = React.useMemo(() => {
    if (activeReplyThread) {
      const targetSk = `SPACE_POST_COMMENT#${activeReplyThread}`;
      const parent = comments.find((c) => c.sk === targetSk) ?? parentComment;
      if (parent) {
        const primary: [string, string] = [parent.author_pk, parent.content];
        const thread: [string, string][] = threadReplies.map((r) => [r.author_pk, r.content]);
        return buildMentionPriority(primary, thread);
      }
    }
    const tuples: [string, string][] = comments.map((c) => [c.author_pk, c.content]);
    return buildMentionPriority(null, tuples);
  }, [activeReplyThread, comments, parentComment, threadReplies]);

  const [likeOverlays, setLikeOverlays] = React.useState<Record<string, [boolean, number]>>({});
  const [contentOverlays, setContentOverlays] = React.useState<Record<string, string>>({});
  const [deletedSks, setDeletedSks] = React.useState<Set<string>>(new Set());
  const [reportedSks, setReportedSks] = React.useState<Set<string>>(new Set());
  const [blockedAuthors, setBlockedAuthors] = React.useState<Set<string>>(new Set());

  const effectiveLiked = (c: DiscussionCommentResponse) => likeOverlays[c.sk]?.[0] ?? c.liked;
  const effectiveLikes = (c: DiscussionCommentResponse) => {
    const overlay = likeOverlays[c.sk];
    if (!overlay) return c.likes;
    const [intent] = overlay;
    const delta = intent === c.liked ? 0 : intent ? 1 : -1;
    return Math.max(0, c.likes + delta);
  };
  const effectiveContent = (c: DiscussionCommentResponse) => contentOverlays[c.sk] ?? c.content;
  const isDeleted = (c: DiscussionCommentResponse) => deletedSks.has(c.sk);
  const isReported = (c: DiscussionCommentResponse) => c.reported || reportedSks.has(c.sk);
  const isAuthorBlocked = (c: DiscussionCommentResponse) => blockedAuthors.has(c.author_pk);

  const likeMut = useLikeComment();
  const likeComment = (skStr: string, next: boolean) => {
    const prevOverlay = likeOverlays[skStr];
    const prevDelta = prevOverlay?.[1] ?? 0;
    setLikeOverlays((prev) => ({ ...prev, [skStr]: [next, prevDelta + (next ? 1 : -1)] }));
    likeMut.mutate(
      { spaceId, discussionSk, commentSk: toCommentTargetId(skStr), req: { like: next } },
      {
        onError: (err) => {
          setLikeOverlays((prev) => {
            const copy = { ...prev };
            if (prevOverlay) copy[skStr] = prevOverlay;
            else delete copy[skStr];
            return copy;
          });
          toast.error(err);
        },
      },
    );
  };

  const updateMut = useUpdateComment();
  const updateComment = (skStr: string, newContent: string) => {
    const prevOverlay = contentOverlays[skStr];
    setContentOverlays((prev) => ({ ...prev, [skStr]: newContent }));
    updateMut.mutate(
      { spaceId, discussionSk, commentSk: toCommentTargetId(skStr), req: { content: newContent, images: null } },
      {
        onSuccess: () => refreshComments(),
        onError: (err) => {
          setContentOverlays((prev) => {
            const copy = { ...prev };
            if (prevOverlay !== undefined) copy[skStr] = prevOverlay;
            else delete copy[skStr];
            return copy;
          });
          toast.error(err);
        },
      },
    );
  };

  const deleteMut = useDeleteComment();
  const deleteComment = (skStr: string) => {
    setDeletedSks((prev) => new Set(prev).add(skStr));
    deleteMut.mutate(
      { spaceId, discussionSk, commentSk: toCommentTargetId(skStr) },
      {
        onSuccess: () => {
          refreshComments();
          void queryClient.invalidateQueries({ queryKey: ["getComment", spaceId, discussionSk, activeReplyThread] });
        },
        onError: (err) => {
          setDeletedSks((prev) => {
            const copy = new Set(prev);
            copy.delete(skStr);
            return copy;
          });
          toast.error(err);
        },
      },
    );
  };

  const addMut = useAddComment();
  const addComment = (content: string, images: string[]) => {
    addMut.mutate({ spaceId, discussionSk, req: { content, images } }, { onSuccess: () => refreshComments(), onError: (err) => toast.error(err) });
  };

  const replyMut = useReplyComment();
  const replyComment = (parentSkStr: string, content: string, images: string[]) => {
    const commentSkBare = toCommentTargetId(parentSkStr);
    replyMut.mutate(
      { spaceId, discussionSk, commentSk: commentSkBare, req: { content, images } },
      {
        onSuccess: () => {
          refreshComments();
          void queryClient.invalidateQueries({ queryKey: ["getComment", spaceId, discussionSk, commentSkBare] });
          setReplyRefreshTick((t) => t + 1);
        },
        onError: (err) => toast.error(err),
      },
    );
  };

  const reportMut = useReportComment();
  const reportComment = (skStr: string, reason: ReportReason, detail: string) => {
    setReportedSks((prev) => new Set(prev).add(skStr));
    reportMut.mutate(
      { spaceId, discussionSk, commentSk: toCommentTargetId(skStr), req: { reason, detail } },
      {
        onSuccess: () => {
          toast.info("Report submitted.");
          refreshComments();
        },
        onError: (err) => {
          setReportedSks((prev) => {
            const copy = new Set(prev);
            copy.delete(skStr);
            return copy;
          });
          toast.error(err);
        },
      },
    );
  };

  const blockMut = useBlockUser();
  const blockUser = (authorPk: string) => {
    setBlockedAuthors((prev) => new Set(prev).add(authorPk));
    blockMut.mutate(authorPk, {
      onSuccess: () => refreshComments(),
      onError: (err) => {
        setBlockedAuthors((prev) => {
          const copy = new Set(prev);
          copy.delete(authorPk);
          return copy;
        });
        toast.error(err);
      },
    });
  };

  const value: UseDiscussionArena = {
    spaceId,
    discussionSk,
    disc,
    discLoading: discQuery.isLoading,
    subscribed,
    togglingSubscription: subscribeMut.isPending || unsubscribeMut.isPending,
    toggleSubscription,
    comments,
    commentsLoading: commentsQuery.isLoading,
    hasMoreComments: bookmark !== null,
    loadingMoreComments: loadingMore,
    loadMoreComments,
    activeReplyThread,
    setActiveReplyThread,
    sheetExpanded,
    setSheetExpanded,
    threadReplies,
    loadThreadReplies,
    parentComment,
    mentionQuery,
    setMentionQuery: setMentionQueryRaw,
    members,
    topPriority,
    pendingMention,
    setPendingMention,
    replyRefreshTick,
    effectiveLiked,
    effectiveLikes,
    effectiveContent,
    isDeleted,
    isReported,
    isAuthorBlocked,
    likeComment,
    likePending: likeMut.isPending,
    updateComment,
    deleteComment,
    addComment,
    replyComment,
    reportComment,
    blockUser,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
