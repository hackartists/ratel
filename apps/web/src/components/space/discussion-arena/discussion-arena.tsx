// app/ratel/src/features/spaces/pages/index/action_pages/discussion/component.rs
// (`DiscussionArenaPage` + `SpaceDiscussionPage`/`SpaceDiscussionCommentPage`).
//
// Mounted two ways, like Rust:
//   - As the space-index overlay (`overlay?.kind === "Discussion"` in
//     `pages/spaces/[spaceId]/page.tsx`) — `useOptionalActionOverlay()` is
//     non-null there, so "Back" closes the overlay instead of navigating.
//   - Standalone at `/spaces/:spaceId/discussions/:discussionId` (and the
//     `/comments/:commentId` deep-link variant) — no overlay provider, so
//     "Back" replaces the route with `/spaces/:spaceId`.
//
// The 5s new-comment poll and the `sort_tick` time-decay re-sort live in
// `hooks/use-discussion-arena.tsx`. `bindCommentTextObservers` in `script.js`
// (overflow measurement → `data-truncatable`) runs unmodified through this
// file's `useLegacyScript`.
import * as React from "react";
import { useNavigate } from "react-router-dom";
import discussionScript from "../../../legacy-scripts/features/spaces/pages/index/action_pages/discussion/script.js?url&no-inline";
import type { DiscussionCommentResponse, ReportReason, SpacePartition, SpacePostEntityType } from "@ratel/ts-bridges";
import { CommentImageGrid } from "@/components/ui/comment-image-grid";
import { ImageUploadPreview, type PendingImage } from "@/components/ui/image-upload-preview";
import { MentionAutocomplete } from "@/components/ui/mention-autocomplete";
import { useOptionalActionOverlay } from "@/components/space/action-overlay";
import { useActionExecuteRole, useSpace } from "@/components/space/space-context";
import { useDiscussionArenaI18n } from "./i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { useLegacyScript } from "@/lib/legacy-scripts";
import { applyMentionMarkup, mentionDisplay, parseMentionSegments } from "@/lib/mention";
import { handlePasteEvent } from "@/lib/paste-image-uploader";
import { usePopup } from "@/lib/popup";
import { canExecuteSpaceAction, isParticipationOpen } from "@/components/space/access";
import { bareCommentId, DiscussionArenaProvider, useDiscussionArena } from "./hooks/use-discussion-arena";

function BackChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

/** Rust `strip_html`. */
function stripHtml(input: string): string {
  let out = "";
  let tag = "";
  let inTag = false;
  for (const c of input) {
    if (c === "<") {
      inTag = true;
      tag = "";
    } else if (c === ">" && inTag) {
      inTag = false;
      const t = tag.trim().toLowerCase();
      if (t === "br" || t === "br/" || t.startsWith("/p") || t.startsWith("/div") || t.startsWith("/li") || t.startsWith("/h")) {
        out += "\n";
      }
    } else if (inTag) {
      tag += c;
    } else {
      out += c;
    }
  }
  return out
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

/** Rust `format_time_ago`. */
function formatTimeAgo(timestamp: number): string {
  const timestampMillis = Math.abs(timestamp) < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  const now = Date.now();
  const diffSecs = Math.floor((now - timestampMillis) / 1000);
  if (diffSecs < 60) return "just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return `${Math.floor(diffSecs / 86400)}d ago`;
}

function CommentText({ content }: { content: string }) {
  const tr = useDiscussionArenaI18n();
  const [expanded, setExpanded] = React.useState(false);
  const plain = stripHtml(content);
  return (
    <div className="comment-text" data-expanded={dataBool(expanded)}>
      <div className="comment-item__text">
        {parseMentionSegments(plain).map((seg, i) =>
          seg.kind === "text" ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <span key={i} className="font-medium text-primary">{`@${seg.displayName}`}</span>
          ),
        )}
      </div>
      <button className="comment-item__expand" onClick={() => setExpanded((v) => !v)}>
        {expanded ? tr.showLess : tr.showMore}
      </button>
    </div>
  );
}

const REPORT_REASONS: { value: ReportReason; labelKey: "reasonSpam" | "reasonHarassment" | "reasonHate" | "reasonViolence" | "reasonSexual" | "reasonOther" }[] = [
  { value: "Spam", labelKey: "reasonSpam" },
  { value: "Harassment", labelKey: "reasonHarassment" },
  { value: "HateSpeech", labelKey: "reasonHate" },
  { value: "Violence", labelKey: "reasonViolence" },
  { value: "SexualContent", labelKey: "reasonSexual" },
  { value: "Other", labelKey: "reasonOther" },
];

function ReportDialog({ onSubmit }: { onSubmit: (reason: ReportReason, detail: string) => void }) {
  const tr = useDiscussionArenaI18n();
  const popup = usePopup();
  const [reason, setReason] = React.useState<ReportReason>("Spam");
  const [detail, setDetail] = React.useState("");

  return (
    <div className="flex flex-col gap-5 max-w-full w-100" data-testid="report-dialog">
      <div className="flex flex-col gap-1">
        {REPORT_REASONS.map(({ value, labelKey }) => (
          <label key={value} className="flex gap-2 items-center py-1.5 text-sm cursor-pointer text-text-primary">
            <input type="radio" name="report-reason" checked={reason === value} onChange={() => setReason(value)} />
            <span>{tr[labelKey]}</span>
          </label>
        ))}
      </div>
      <textarea
        className="p-2 w-full text-sm rounded-lg border bg-input-box-bg border-input-box-border text-text-primary"
        data-testid="report-detail"
        rows={2}
        placeholder={tr.reportDetailPlaceholder}
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      <div className="flex flex-col gap-2.5 w-full">
        <button
          className="py-2.5 px-4 w-full text-sm font-bold text-white rounded-lg cursor-pointer hover:opacity-90"
          style={{ backgroundColor: "#ef4444" }}
          data-testid="report-submit"
          onClick={() => {
            onSubmit(reason, detail);
            popup.close();
          }}
        >
          {tr.reportSubmit}
        </button>
        <button
          className="py-2.5 px-4 w-full text-sm font-medium rounded-lg border cursor-pointer border-border text-c-secondary hover:bg-hover"
          onClick={() => popup.close()}
        >
          {tr.reportCancel}
        </button>
      </div>
    </div>
  );
}

function MoreOptionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
function LikeIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CommentCardBody({
  comment,
  canComment,
  domId = "",
  isDeepLink = false,
  children,
}: {
  comment: DiscussionCommentResponse;
  canComment: boolean;
  domId?: string;
  isDeepLink?: boolean;
  children?: React.ReactNode;
}) {
  const tr = useDiscussionArenaI18n();
  const arena = useDiscussionArena();
  const alreadyReported = arena.isReported(comment);
  const { user } = useUserContext();
  const isOwn = user?.pk === comment.author_pk;

  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [menuOpen]);

  const [editing, setEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(comment.content);
  const popup = usePopup();
  const timeAgo = formatTimeAgo(comment.created_at);

  const onLike = () => {
    const next = !arena.effectiveLiked(comment);
    arena.likeComment(comment.sk, next);
  };
  const onEditStart = () => {
    setEditText(comment.content);
    setEditing(true);
    setMenuOpen(false);
  };
  const onEditSave = () => {
    const newText = editText.trim();
    if (newText === "") return;
    setEditing(false);
    arena.updateComment(comment.sk, newText);
  };
  const onDelete = () => {
    setMenuOpen(false);
    arena.deleteComment(comment.sk);
  };
  const onBlock = () => {
    setMenuOpen(false);
    arena.blockUser(comment.author_pk);
  };

  const liked = arena.effectiveLiked(comment);
  const likesCount = arena.effectiveLikes(comment);
  const effectiveText = arena.effectiveContent(comment);

  return (
    <div className="comment-item" id={domId} data-deep-link={dataBool(isDeepLink)}>
      <img className="comment-item__avatar" src={comment.author_profile_url} alt={comment.author_display_name} />
      <div className="comment-item__body">
        <div className="comment-item__top">
          <span className="comment-item__name">{comment.author_display_name}</span>
          <span className="comment-item__time">{timeAgo}</span>
          {isOwn && canComment && !editing && (
            <div className="comment-menu" ref={menuRef}>
              <button className="comment-menu__trigger" data-testid="comment-menu-trigger" aria-label={tr.moreOptions} onClick={() => setMenuOpen((v) => !v)}>
                <MoreOptionsIcon />
              </button>
              {menuOpen && (
                <div className="comment-menu__dropdown">
                  <button className="comment-menu__item" data-testid="comment-menu-edit" onClick={onEditStart}>
                    {tr.editBtn}
                  </button>
                  <button className="comment-menu__item comment-menu__item--danger" data-testid="comment-menu-delete" onClick={onDelete}>
                    {tr.deleteBtn}
                  </button>
                </div>
              )}
            </div>
          )}
          {!isOwn && canComment && !editing && (
            <div className="comment-menu" ref={menuRef}>
              <button className="comment-menu__trigger" data-testid="comment-menu-trigger" aria-label={tr.moreOptions} onClick={() => setMenuOpen((v) => !v)}>
                <MoreOptionsIcon />
              </button>
              {menuOpen && (
                <div className="comment-menu__dropdown">
                  {alreadyReported ? (
                    <button className="comment-menu__item" disabled data-testid="comment-menu-reported">
                      {tr.reportedBtn}
                    </button>
                  ) : (
                    <button
                      className="comment-menu__item"
                      data-testid="comment-menu-report"
                      onClick={() => {
                        setMenuOpen(false);
                        popup.open(
                          <ReportDialog onSubmit={(reason, detail) => arena.reportComment(comment.sk, reason, detail)} />,
                          { title: tr.reportTitle, description: tr.reportDesc },
                        );
                      }}
                    >
                      {tr.reportBtn}
                    </button>
                  )}
                  <button className="comment-menu__item comment-menu__item--danger" data-testid="comment-menu-block" onClick={onBlock}>
                    {tr.blockBtn}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <div className="comment-item__edit">
            <textarea className="comment-item__edit-input" data-testid="comment-edit-input" rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div className="comment-item__edit-actions">
              <button className="comment-item__edit-cancel" data-testid="comment-edit-cancel" onClick={() => setEditing(false)}>
                {tr.cancelBtn}
              </button>
              <button className="comment-item__edit-save" data-testid="comment-edit-save" disabled={editText.trim() === ""} onClick={onEditSave}>
                {tr.saveBtn}
              </button>
            </div>
          </div>
        ) : (
          <>
            <CommentText content={effectiveText} />
            <CommentImageGrid images={comment.images} />
            <div className="comment-item__actions">
              <button className="comment-action" aria-pressed={liked} disabled={arena.likePending} onClick={onLike}>
                <LikeIcon filled={liked} />
                <span>{likesCount}</span>
              </button>
              {children}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CommentItem({ comment, canComment, deepLinkTarget }: { comment: DiscussionCommentResponse; canComment: boolean; deepLinkTarget: string | null }) {
  const tr = useDiscussionArenaI18n();
  const arena = useDiscussionArena();
  const [showReplies, setShowReplies] = React.useState(false);
  const [replies, setReplies] = React.useState<DiscussionCommentResponse[]>([]);
  const commentBareId = bareCommentId(comment.sk);
  const replyCount = comment.replies;
  const sortedReplies = React.useMemo(() => [...replies].sort((a, b) => a.created_at - b.created_at), [replies]);
  const isDeepLink = deepLinkTarget === commentBareId;
  const isThreadActive = arena.activeReplyThread === commentBareId;

  const fetchReplies = async () => {
    if (replies.length === 0 && replyCount > 0) {
      setReplies(await arena.loadThreadReplies(commentBareId));
    }
  };

  const onReplyClick = async () => {
    if (arena.activeReplyThread === commentBareId) {
      arena.setActiveReplyThread(null);
      return;
    }
    arena.setActiveReplyThread(commentBareId);
    arena.setSheetExpanded(true);
    setShowReplies(true);
    await fetchReplies();
  };

  const onToggleReplies = async () => {
    const next = !showReplies;
    setShowReplies(next);
    if (next) await fetchReplies();
  };

  React.useEffect(() => {
    if (arena.replyRefreshTick === 0) return;
    if (arena.activeReplyThread !== commentBareId) return;
    arena.loadThreadReplies(commentBareId).then(setReplies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena.replyRefreshTick]);

  return (
    <div className="comment-entry" data-thread-active={dataBool(isThreadActive)}>
      <CommentCardBody comment={comment} canComment={canComment} domId={commentBareId} isDeepLink={isDeepLink}>
        {canComment && (
          <button className="comment-action comment-action--reply" data-testid="comment-action-reply" onClick={() => void onReplyClick()}>
            <ReplyIcon />
            <span>{tr.replyLabel}</span>
            {replyCount > 0 && <span className="comment-action__reply-count">{replyCount}</span>}
          </button>
        )}
      </CommentCardBody>

      {replyCount > 0 && (
        <button className="reply-toggle" onClick={() => void onToggleReplies()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {showReplies ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
          </svg>
          {`${replyCount} ${tr.repliesLabel}`}
        </button>
      )}

      {showReplies && (
        <div className="comment-replies">
          {sortedReplies
            .filter((r) => !arena.isDeleted(r) && !arena.isAuthorBlocked(r))
            .map((reply) => (
              <ReplyItem key={reply.sk} reply={reply} canComment={canComment} parentDomId={commentBareId} />
            ))}
        </div>
      )}
    </div>
  );
}

function ReplyItem({ reply, canComment, parentDomId }: { reply: DiscussionCommentResponse; canComment: boolean; parentDomId: string }) {
  const tr = useDiscussionArenaI18n();
  const arena = useDiscussionArena();

  const onReplyClick = () => {
    arena.setActiveReplyThread(parentDomId);
    arena.setSheetExpanded(true);
    arena.setPendingMention({ displayName: reply.author_display_name, userPk: reply.author_pk });
    const el = document.getElementById(parentDomId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <CommentCardBody comment={reply} canComment={canComment}>
      {canComment && (
        <button className="comment-action comment-action--reply" data-testid="reply-action-reply" onClick={onReplyClick}>
          <ReplyIcon />
          <span>{tr.replyLabel}</span>
        </button>
      )}
    </CommentCardBody>
  );
}

function CommentComposer({
  text,
  setText,
  trackedMentions,
  setTrackedMentions,
  pendingImages,
  setPendingImages,
  onSubmit,
  placeholder,
  disabled,
  onMentionQueryChange,
  onComposerFocus,
  priorityUserPks,
  replyQuote,
  onCancelReply,
}: {
  text: string;
  setText: (v: string) => void;
  trackedMentions: [string, string][];
  setTrackedMentions: (v: [string, string][]) => void;
  pendingImages: PendingImage[];
  setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
  onMentionQueryChange: (q: string | null) => void;
  onComposerFocus: () => void;
  priorityUserPks: string[];
  replyQuote: { author: string; text: string } | null;
  onCancelReply: () => void;
}) {
  const tr = useDiscussionArenaI18n();
  const arena = useDiscussionArena();

  return (
    <div
      className="comment-input"
      onPaste={(e) => {
        if (handlePasteEvent(e, pendingImages, setPendingImages)) e.preventDefault();
      }}
    >
      {replyQuote && (
        <div className="comment-input__quote">
          <div className="comment-input__quote-body">
            <div className="comment-input__quote-label">{`${tr.replyingTo} ${replyQuote.author}`}</div>
            <div className="comment-input__quote-text">{replyQuote.text}</div>
          </div>
          <button className="comment-input__quote-close" data-testid="comment-input-quote-close" aria-label={tr.cancelReplyAria} onClick={onCancelReply}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      <ImageUploadPreview images={pendingImages} onChange={setPendingImages} />
      <div className="reply-input">
        <MentionAutocomplete
          text={text}
          members={arena.members}
          onQueryChange={onMentionQueryChange}
          priorityUserPks={priorityUserPks}
          onSelect={(insert) => {
            if (insert.startOffset <= text.length && insert.endOffset <= text.length) {
              setText(text.slice(0, insert.startOffset) + insert.displayText + text.slice(insert.endOffset));
              setTrackedMentions([...trackedMentions, [insert.displayName, insert.userPk]]);
            }
          }}
        >
          <textarea
            className="reply-input__field comment-input__textarea"
            placeholder={placeholder}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                onSubmit();
              }
            }}
            onFocus={onComposerFocus}
          />
        </MentionAutocomplete>
        <button className="reply-input__send comment-input__submit" disabled={disabled} onClick={onSubmit}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DiscussionArenaContent({ targetCommentId }: { targetCommentId: string | null }) {
  const tr = useDiscussionArenaI18n();
  const arena = useDiscussionArena();
  const role = useActionExecuteRole();
  const space = useSpace();
  const overlayCtx = useOptionalActionOverlay();
  const navigate = useNavigate();
  useLegacyScript(discussionScript, { module: true });

  // Every hook runs before the `arena.disc` early return below, so the hook
  // order is identical while the discussion is loading and once it arrives.
  const [deepLinkTarget] = React.useState(targetCommentId);
  const [deepLinkDone, setDeepLinkDone] = React.useState(targetCommentId === null);
  React.useEffect(() => {
    if (deepLinkDone || deepLinkTarget === null) return;
    arena.setSheetExpanded(true);
    const el = document.getElementById(deepLinkTarget);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setDeepLinkDone(true);
    }
    // Retried on every comments-list change until the target mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena.comments, deepLinkDone]);

  const [commentText, setCommentText] = React.useState("");
  const [trackedMentions, setTrackedMentions] = React.useState<[string, string][]>([]);
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([]);
  const [mentionQueryRaw, setMentionQueryRaw] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!arena.pendingMention) return;
    const { displayName, userPk } = arena.pendingMention;
    const mentionText = mentionDisplay(displayName);
    setCommentText((current) => (current !== "" && !/\s$/.test(current) ? `${current} ${mentionText}` : `${current}${mentionText}`));
    setTrackedMentions((prev) => [...prev, [displayName, userPk]]);
    arena.setPendingMention(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena.pendingMention]);

  const onMentionQueryChange = (q: string | null) => {
    setMentionQueryRaw(q);
    arena.setMentionQuery(q);
  };
  const onComposerFocus = () => {
    if (mentionQueryRaw === null) {
      setMentionQueryRaw("");
      arena.setMentionQuery("");
    }
  };

  const replyQuote = React.useMemo(() => {
    const threadId = arena.activeReplyThread;
    if (!threadId) return null;
    const match = arena.comments.find((c) => bareCommentId(c.sk) === threadId);
    if (!match) return null;
    return { author: match.author_display_name, text: match.content };
  }, [arena.activeReplyThread, arena.comments]);

  if (!arena.disc) return null;
  const { post, space_action } = arena.disc;

  const status: "InProgress" | "NotStarted" | "Finish" =
    space_action.status === "Ongoing" ? "InProgress" : space_action.status === "Finish" ? "Finish" : "NotStarted";
  const isInProgress = status === "InProgress";
  const canRespond = role === "Creator" || role === "Participant";
  const canExecute = canExecuteSpaceAction(role, space_action.prerequisite, space.status, space_action.status, true, isParticipationOpen(space));
  const isCreator = role === "Creator";
  const canComment = canRespond && canExecute && (isCreator || isInProgress);

  const onBack = () => {
    if (overlayCtx) {
      overlayCtx.setOverlay(null);
    } else {
      navigate(`/spaces/${arena.spaceId}`, { replace: true });
    }
  };

  const onSubmit = () => {
    const rawText = commentText.trim();
    const images = pendingImages.filter((img) => img.remoteUrl != null).map((img) => img.remoteUrl as string);
    if (rawText === "" && images.length === 0) return;
    const content = applyMentionMarkup(rawText, trackedMentions);
    if (arena.activeReplyThread) {
      arena.replyComment(`SPACE_POST_COMMENT#${arena.activeReplyThread}`, content, images);
    } else {
      arena.addComment(content, images);
    }
    setCommentText("");
    setTrackedMentions([]);
    setPendingImages([]);
  };

  const inThread = arena.activeReplyThread !== null;
  const statusText = status === "InProgress" ? tr.statusInProgress : status === "NotStarted" ? tr.statusNotStarted : tr.statusFinished;
  const statusClass =
    status === "InProgress" ? "topbar__status topbar__status--active" : status === "NotStarted" ? "topbar__status topbar__status--not-started" : "topbar__status topbar__status--ended";
  const createdDate = new Date(Math.floor(post.created_at / 1000) * 1000).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

  const visibleComments = arena.comments.filter((c) => !arena.isDeleted(c) && !arena.isAuthorBlocked(c));

  return (
    <div className="discussion-arena" data-testid="discussion-arena-overlay">
      <div className="topbar">
        <div className="topbar__left">
          <button className="topbar__back" data-testid="discussion-arena-back" onClick={onBack}>
            <BackChevronIcon />
          </button>
          <span className="topbar__title">{post.title}</span>
        </div>
        <div className="topbar__right">
          <button
            className="topbar__subscribe"
            data-testid="discussion-subscribe-btn"
            aria-label={tr.subscribeTooltip}
            title={tr.subscribeTooltip}
            aria-pressed={arena.subscribed || isCreator}
            disabled={isCreator || arena.togglingSubscription}
            onClick={() => {
              if (!isCreator) arena.toggleSubscription();
            }}
          >
            {arena.subscribed || isCreator ? tr.subscribedBtn : tr.subscribeBtn}
          </button>
          <span className={statusClass}>{statusText}</span>
        </div>
      </div>

      {status === "Finish" && <div className="disc-banner disc-banner--warning">{tr.discussionEnded}</div>}
      {status === "NotStarted" && <div className="disc-banner disc-banner--info">{tr.discussionNotStarted}</div>}

      <div className="discussion-layout">
        <div className="discussion-main">
          <div className="discussion-main__inner">
            <div className="disc-header">
              <span className="disc-header__type">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {tr.discussionLabel}
              </span>
              <h1 className="disc-header__title">{post.title}</h1>
              <div className="disc-header__meta">
                <div className="disc-header__author">
                  <img className="disc-header__avatar" src={post.author_profile_url} alt={post.author_display_name} />
                  <span className="disc-header__author-name">{post.author_display_name}</span>
                </div>
                <span className="disc-header__separator" />
                <span className="disc-header__date">{createdDate}</span>
                {post.category_name !== "" && <span className="disc-header__type">{post.category_name}</span>}
              </div>
            </div>

            {post.html_contents !== "" && (
              <div className="disc-body">
                <div className="disc-body__content" dangerouslySetInnerHTML={{ __html: post.html_contents }} />
              </div>
            )}

            {post.files.length > 0 && (
              <div className="disc-files">
                <span className="disc-files__label">{tr.attachmentsLabel}</span>
                <div className="disc-files__grid">
                  {post.files.map((file) => (
                    <a key={file.id} className="file-card" href={file.url ?? ""} target="_blank" rel="noreferrer" download={file.name}>
                      <div className="file-card__icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="file-card__info">
                        <div className="file-card__name">{file.name}</div>
                        <div className="file-card__size">{file.size}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="comments-panel__resizer" id="comments-panel-resizer" role="separator" aria-label="Resize comments panel" aria-orientation="vertical" />

        <div className="comments-panel" id="discussion-comments-sheet" data-expanded={dataBool(arena.sheetExpanded)}>
          <div className="sheet-handle" onClick={() => arena.setSheetExpanded(!arena.sheetExpanded)}>
            <div className="sheet-handle__bar" />
            <div className="sheet-handle__row">
              <div className="sheet-handle__left">
                <span className="sheet-handle__title">{tr.commentsTitle}</span>
                <span className="sheet-handle__count">{post.comments}</span>
              </div>
              <svg className="sheet-handle__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          <div className="comments-panel__body">
            <div className="comments-panel__header">
              <span className="comments-panel__title">{tr.commentsTitle}</span>
              <span className="comments-panel__count">{post.comments}</span>
            </div>

            <div className="comments-scroll" data-thread-active={dataBool(inThread)}>
              <div className="comment-list">
                {visibleComments.map((comment) => (
                  <CommentItem key={comment.sk} comment={comment} canComment={canComment} deepLinkTarget={deepLinkTarget} />
                ))}
                {arena.hasMoreComments &&
                  (arena.loadingMoreComments ? (
                    <div>Loading more...</div>
                  ) : (
                    <button onClick={arena.loadMoreComments}>{tr.loadMore}</button>
                  ))}
              </div>
            </div>

            {canComment && (
              <CommentComposer
                text={commentText}
                setText={setCommentText}
                trackedMentions={trackedMentions}
                setTrackedMentions={setTrackedMentions}
                pendingImages={pendingImages}
                setPendingImages={setPendingImages}
                onSubmit={onSubmit}
                placeholder={inThread ? tr.replyPlaceholder : tr.commentPlaceholder}
                disabled={commentText.trim() === "" && pendingImages.length === 0}
                onMentionQueryChange={onMentionQueryChange}
                onComposerFocus={onComposerFocus}
                priorityUserPks={arena.topPriority}
                replyQuote={replyQuote}
                onCancelReply={() => arena.setActiveReplyThread(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface DiscussionArenaPageProps {
  spaceId: SpacePartition;
  discussionId: SpacePostEntityType;
  targetCommentId?: string | null;
}

export function DiscussionArenaPage({ spaceId, discussionId, targetCommentId = null }: DiscussionArenaPageProps) {
  return (
    <DiscussionArenaProvider spaceId={spaceId} discussionSk={discussionId}>
      <DiscussionArenaContent targetCommentId={targetCommentId} />
    </DiscussionArenaProvider>
  );
}
