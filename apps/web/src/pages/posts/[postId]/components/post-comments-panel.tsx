import { useEffect, useMemo, useState } from "react";
import type { PostCommentResponse } from "@ratel/ts-bridges";
import { MentionAutocomplete } from "@/components/mentions/mention-autocomplete";
import type { PostDetailSyndicatedI18n } from "@/i18n/generated/features/posts/views/post_detail/post-detail-syndicated.i18n";
import { parseMentionSegments } from "@/lib/mention";
import type { UsePostDetail } from "../hooks/use-post-detail";

// app/ratel/src/features/posts/views/post_detail/comments.rs
// (`PostCommentsPanel`, `CommentItem`, `ReplyItem`).

export interface PostCommentsPanelProps {
  tr: PostDetailSyndicatedI18n;
  postDetail: UsePostDetail;
}

export function PostCommentsPanel({ tr, postDetail }: PostCommentsPanelProps) {
  const { detail, commentText, setCommentText, isSubmitting, submitComment } = postDetail;
  const total = detail?.post?.comments ?? 0;

  const comments: PostCommentResponse[] = useMemo(() => {
    const out: PostCommentResponse[] = [];
    for (const c of detail?.comments ?? []) {
      if (c.parent_comment_sk === null && !out.some((x) => x.sk === c.sk)) out.push(c);
    }
    return out;
  }, [detail]);

  return (
    <div className="comments-panel" id="post-comments-sheet">
      <div className="sheet-handle">
        <div className="sheet-handle__bar" />
        <div className="sheet-handle__row">
          <div className="sheet-handle__left">
            <span className="sheet-handle__title">{tr.drawerCommentsTitle}</span>
            <span className="sheet-handle__count">{total}</span>
          </div>
          <svg className="sheet-handle__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div className="comments-panel__header">
        <span className="comments-panel__title">{tr.drawerCommentsTitle}</span>
        <span className="comments-panel__count">{total}</span>
      </div>

      <div className="comment-input">
        <div className="comment-input__wrapper">
          <div className="comment-input__body">
            <MentionAutocomplete
              text={commentText}
              onSelect={(insert) => {
                if (insert.startOffset <= commentText.length && insert.endOffset <= commentText.length) {
                  const val =
                    commentText.slice(0, insert.startOffset) + insert.displayText + commentText.slice(insert.endOffset);
                  setCommentText(val);
                  postDetail.addTrackedMention(insert.displayName, insert.userPk);
                }
              }}
              members={[]}
            >
              <textarea
                className="comment-input__textarea"
                placeholder={tr.commentPlaceholder}
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
            </MentionAutocomplete>
            <div className="comment-input__footer">
              <button className="comment-input__submit" disabled={commentText.trim() === "" || isSubmitting} onClick={submitComment}>
                {tr.postBtn}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="comments-scroll">
        <div className="comment-list">
          {comments.map((comment) => (
            <CommentItem key={comment.sk} tr={tr} comment={comment} postDetail={postDetail} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CommentItem({ tr, comment, postDetail }: { tr: PostDetailSyndicatedI18n; comment: PostCommentResponse; postDetail: UsePostDetail }) {
  const { repliesByComment, commentLikes, toggleCommentLike, submitReply, loadReplies } = postDetail;

  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyMentions, setReplyMentions] = useState<Array<[string, string]>>([]);

  const timeAgo = formatTimeAgo(comment.updated_at);
  const replyCount = comment.replies;
  const sk = comment.sk;

  const replies = repliesByComment[sk] ?? [];
  const liked = commentLikes[sk]?.liked ?? comment.liked;
  const likes = commentLikes[sk]?.likes ?? comment.likes;

  useEffect(() => {
    if (showReplies && replyCount > 0) loadReplies(sk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReplies]);

  const onSubmitReply = () => {
    const raw = replyText.trim();
    if (raw === "") return;
    setReplyText("");
    setReplyMentions([]);
    submitReply(sk, raw, replyMentions);
  };

  return (
    <div className="comment-entry">
      <div className="comment-item">
        <img className="comment-item__avatar" src={comment.author_profile_url} alt={comment.author_display_name} />
        <div className="comment-item__body">
          <div className="comment-item__top">
            <span className="comment-item__name">{comment.author_display_name}</span>
            <span className="comment-item__time">{timeAgo}</span>
          </div>
          <div className="comment-item__text">
            {parseMentionSegments(comment.content).map((seg, i) =>
              seg.kind === "text" ? (
                <span key={i}>{seg.text}</span>
              ) : (
                <span key={i} className="comment-item__mention">
                  @{seg.displayName}
                </span>
              ),
            )}
          </div>
          <div className="comment-item__actions">
            <button
              className={liked ? "comment-action comment-action--liked" : "comment-action"}
              onClick={() => toggleCommentLike(sk, !liked)}
            >
              <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>{likes}</span>
            </button>
            <button className="comment-action comment-action--reply" onClick={() => setShowReplies(!showReplies)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span>{tr.replyLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {replyCount > 0 && (
        <button className="reply-toggle" onClick={() => setShowReplies(!showReplies)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {showReplies ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
          </svg>
          {replyCount} {tr.repliesLabel}
        </button>
      )}

      {showReplies && (
        <>
          <div className="reply-input">
            <MentionAutocomplete
              text={replyText}
              onSelect={(insert) => {
                if (insert.startOffset <= replyText.length && insert.endOffset <= replyText.length) {
                  const val = replyText.slice(0, insert.startOffset) + insert.displayText + replyText.slice(insert.endOffset);
                  setReplyText(val);
                  setReplyMentions((m) => [...m, [insert.displayName, insert.userPk]]);
                }
              }}
              members={[]}
            >
              <input
                className="reply-input__field"
                placeholder={tr.replyPlaceholder}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
            </MentionAutocomplete>
            <button className="reply-input__send" onClick={onSubmitReply}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {replies.length > 0 && (
            <div className="comment-replies">
              {replies.map((reply) => (
                <ReplyItem key={reply.sk} reply={reply} postDetail={postDetail} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReplyItem({ reply, postDetail }: { reply: PostCommentResponse; postDetail: UsePostDetail }) {
  const { commentLikes, toggleCommentLike } = postDetail;
  const timeAgo = formatTimeAgo(reply.updated_at);
  const sk = reply.sk;
  const liked = commentLikes[sk]?.liked ?? reply.liked;
  const likes = commentLikes[sk]?.likes ?? reply.likes;

  return (
    <div className="comment-item">
      <img className="comment-item__avatar" src={reply.author_profile_url} alt={reply.author_display_name} />
      <div className="comment-item__body">
        <div className="comment-item__top">
          <span className="comment-item__name">{reply.author_display_name}</span>
          <span className="comment-item__time">{timeAgo}</span>
        </div>
        <div className="comment-item__text">
          {parseMentionSegments(reply.content).map((seg, i) =>
            seg.kind === "text" ? (
              <span key={i}>{seg.text}</span>
            ) : (
              <span key={i} className="comment-item__mention">
                @{seg.displayName}
              </span>
            ),
          )}
        </div>
        <div className="comment-item__actions">
          <button
            className={liked ? "comment-action comment-action--liked" : "comment-action"}
            onClick={() => toggleCommentLike(sk, !liked)}
          >
            <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{likes}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(tsMsOrS: number): string {
  const tsMs = Math.abs(tsMsOrS) < 1_000_000_000_000 ? tsMsOrS * 1000 : tsMsOrS;
  const now = Date.now();
  const diff = Math.max(Math.floor((now - tsMs) / 1000), 0);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
