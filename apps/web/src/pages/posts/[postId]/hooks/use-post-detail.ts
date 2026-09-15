import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FeedPartition, PostComment, PostCommentResponse, PostDetailResponse } from "@ratel/ts-bridges";
import { listCommentsHandler } from "@ratel/ts-bridges";
import {
  useAddCommentHandler,
  useGetPost,
  useLikeCommentHandler,
  useLikePost,
  useReplyToComment,
} from "@ratel/ts-bridges/hooks";
import { applyMentionMarkup } from "@/lib/mention";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/posts/hooks/use_post_detail.rs (`UsePostDetail`).
// One controller for the hero card + the comments drawer
// (`PostCommentsPanel`/`CommentItem`/`ReplyItem`), so a like/comment toggled
// from either surface stays in sync without prop drilling.

function toPostCommentResponse(comment: PostComment, liked: boolean, isReport: boolean): PostCommentResponse {
  return {
    pk: comment.post_id,
    sk: comment.id,
    updated_at: comment.updated_at,
    content: comment.content,
    images: comment.images,
    likes: comment.likes,
    reports: comment.reports,
    replies: comment.replies,
    parent_comment_sk: comment.parent_comment_id,
    author_pk: comment.author_pk,
    author_display_name: comment.author_display_name,
    author_username: comment.author_username,
    author_profile_url: comment.author_profile_url,
    liked,
    is_report: isReport,
  };
}

export interface UsePostDetail {
  ready: boolean;
  detail: PostDetailResponse | null;
  postId: FeedPartition;

  liked: boolean;
  likeCount: number;
  commentsOpen: boolean;
  setCommentsOpen: (open: boolean) => void;

  commentText: string;
  setCommentText: (v: string) => void;
  trackedMentions: Array<[string, string]>;
  addTrackedMention: (displayName: string, userPk: string) => void;
  clearTrackedMentions: () => void;
  isSubmitting: boolean;

  repliesByComment: Record<string, PostCommentResponse[]>;
  repliesLoaded: Set<string>;
  commentLikes: Record<string, { liked: boolean; likes: number }>;

  toggleLike: () => void;
  share: () => Promise<boolean>;
  submitComment: () => void;
  toggleCommentLike: (targetSk: string, nextLiked: boolean) => void;
  submitReply: (parentSk: string, raw: string, mentions: Array<[string, string]>) => void;
  loadReplies: (parentSk: string) => void;
}

export function usePostDetail(postId: FeedPartition): UsePostDetail {
  const toast = useToast();
  const queryClient = useQueryClient();

  const detailQuery = useGetPost(postId);
  const ready = detailQuery.isSuccess;
  const detail = detailQuery.data ?? null;

  const likeMutation = useLikePost();
  const addCommentMutation = useAddCommentHandler();
  const replyMutation = useReplyToComment();
  const likeCommentMutation = useLikeCommentHandler();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const seeded = useRef(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [trackedMentions, setTrackedMentions] = useState<Array<[string, string]>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repliesByComment, setRepliesByComment] = useState<Record<string, PostCommentResponse[]>>({});
  const [repliesLoaded, setRepliesLoaded] = useState<Set<string>>(new Set());
  const [commentLikes, setCommentLikes] = useState<Record<string, { liked: boolean; likes: number }>>({});

  if (ready && !seeded.current && detail) {
    seeded.current = true;
    setLiked(detail.is_liked);
    setLikeCount(detail.post?.likes ?? 0);
    setCommentLikes(
      Object.fromEntries(detail.comments.map((c) => [c.sk, { liked: c.liked, likes: c.likes }])),
    );
  }

  const toggleLike = () => {
    const next = !liked;
    const prevCount = likeCount;
    setLiked(next);
    setLikeCount(Math.max(prevCount + (next ? 1 : -1), 0));
    likeMutation.mutate(
      { postId, like: next },
      {
        onError: () => {
          setLiked(!next);
          setLikeCount(prevCount);
        },
      },
    );
  };

  const share = async (): Promise<boolean> => {
    const url = `${window.location.origin}/posts/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.info("Link copied to clipboard");
      return true;
    } catch {
      toast.warn("Failed to copy link");
      return false;
    }
  };

  const submitComment = () => {
    const raw = commentText.trim();
    if (raw === "" || isSubmitting) return;
    setIsSubmitting(true);
    const content = applyMentionMarkup(raw, trackedMentions);
    addCommentMutation.mutate(
      { postId, req: { content, images: [] } },
      {
        onSuccess: () => {
          setCommentText("");
          setTrackedMentions([]);
          setIsSubmitting(false);
          void queryClient.invalidateQueries({ queryKey: ["getPost", postId] });
        },
        onError: (e) => {
          setIsSubmitting(false);
          toast.error(e);
        },
      },
    );
  };

  const toggleCommentLike = (targetSk: string, nextLiked: boolean) => {
    const prev = commentLikes[targetSk] ?? { liked: !nextLiked, likes: 0 };
    const optimisticCount = Math.max(prev.likes + (nextLiked ? 1 : -1), 0);
    setCommentLikes((m) => ({ ...m, [targetSk]: { liked: nextLiked, likes: optimisticCount } }));
    likeCommentMutation.mutate(
      { postId, commentId: targetSk, liked: nextLiked },
      {
        onError: (e) => {
          setCommentLikes((m) => ({ ...m, [targetSk]: prev }));
          toast.error(e);
        },
      },
    );
  };

  const submitReply = (parentSk: string, raw: string, mentions: Array<[string, string]>) => {
    const trimmed = raw.trim();
    if (trimmed === "") return;
    const content = applyMentionMarkup(trimmed, mentions);
    replyMutation.mutate(
      { postId, commentId: parentSk, req: { content, images: [] } },
      {
        onSuccess: (newReplyModel) => {
          const newReply = toPostCommentResponse(newReplyModel, false, false);
          setRepliesByComment((m) => ({ ...m, [parentSk]: [newReply, ...(m[parentSk] ?? [])] }));
          setCommentLikes((m) => ({ ...m, [newReply.sk]: { liked: false, likes: 0 } }));
        },
        onError: (e) => toast.error(e),
      },
    );
  };

  // Rust `load_replies` is a `use_action` (imperative fetch-on-expand, not a
  // declarative query), so this calls the generated handler directly rather
  // than going through a react-query hook — matching the "the hook file is
  // the only module that imports `_handler` functions" convention.
  const loadReplies = (parentSk: string) => {
    if (repliesLoaded.has(parentSk)) return;
    listCommentsHandler(postId, parentSk)
      .then((resp) => {
        setCommentLikes((m) => {
          const next = { ...m };
          for (const r of resp.items) next[r.sk] = { liked: r.liked, likes: r.likes };
          return next;
        });
        setRepliesByComment((m) => ({ ...m, [parentSk]: resp.items }));
        setRepliesLoaded((s) => new Set(s).add(parentSk));
      })
      .catch((e) => toast.error(e));
  };

  return {
    ready,
    detail,
    postId,
    liked,
    likeCount,
    commentsOpen,
    setCommentsOpen,
    commentText,
    setCommentText,
    trackedMentions,
    addTrackedMention: (displayName, userPk) => setTrackedMentions((m) => [...m, [displayName, userPk]]),
    clearTrackedMentions: () => setTrackedMentions([]),
    isSubmitting,
    repliesByComment,
    repliesLoaded,
    commentLikes,
    toggleLike,
    share,
    submitComment,
    toggleCommentLike,
    submitReply,
    loadReplies,
  };
}
