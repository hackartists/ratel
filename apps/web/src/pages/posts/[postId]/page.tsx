import { Link, useNavigate, useParams } from "react-router-dom";
import postDetailScript from "../../../../../../app/ratel/src/features/posts/views/post_detail/script.js?url&no-inline";
import { SyndicationPanel } from "@/components/cross-posting/syndication-panel";
import { SeoMeta } from "@/components/ui/seo-meta";
import { usePostDetailSyndicatedI18n, type PostDetailSyndicatedI18n } from "@/i18n/generated/features/posts/views/post_detail/post-detail-syndicated.i18n";
import { useUserContext } from "@/lib/auth";
import { toHtml } from "@/lib/content-body";
import { dataBool } from "@/lib/dom";
import { useLegacyScript } from "@/lib/legacy-scripts";
import { PostCommentsPanel } from "./components/post-comments-panel";
import { usePostDetail } from "./hooks/use-post-detail";

// app/ratel/src/features/posts/views/post_detail/component.rs (`PostDetail`,
// `/posts/:postId`).

function readMinutesFromHtml(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter((w) => w !== "").length;
  return Math.max(Math.floor(words / 220), 1);
}

function stripHtmlExcerpt(html: string, n: number): string {
  const text = html.replace(/<[^>]*>/g, "");
  return [...text].slice(0, n).join("");
}

function formatPublished(tr: PostDetailSyndicatedI18n, createdAtMs: number, readMinutes: number): string {
  const nowMs = Date.now();
  const deltaSec = Math.max(Math.floor((nowMs - createdAtMs) / 1000), 0);
  let when = "";
  if (createdAtMs > 0) {
    if (deltaSec < 60) when = tr.publishedJustNow;
    else if (deltaSec < 3600) when = tr.publishedMinutesAgo({ n: Math.floor(deltaSec / 60) });
    else if (deltaSec < 86400) when = tr.publishedHoursAgo({ n: Math.floor(deltaSec / 3600) });
    else when = tr.publishedDaysAgo({ n: Math.floor(deltaSec / 86400) });
  }
  const read = tr.minRead({ n: readMinutes });
  return when === "" ? read : `${when} · ${read}`;
}

export function Component() {
  const { postId = "" } = useParams<{ postId: string }>();
  const tr = usePostDetailSyndicatedI18n();
  const nav = useNavigate();
  const userContext = useUserContext();
  useLegacyScript(postDetailScript);

  const pd = usePostDetail(postId);

  if (!pd.ready) return null;

  const { detail, liked, likeCount, commentsOpen, setCommentsOpen, toggleLike, share } = pd;
  const post = detail?.post ?? null;

  const canEdit = (detail?.is_post_owner ?? false) || detail?.viewer_role === "owner" || detail?.viewer_role === "admin";

  const postTitle = post?.title ?? "";
  const postHtml = post ? toHtml(post.body) : "";
  const postImage = post?.urls[0] ?? "";
  const postAttachments = post?.attachments ?? [];
  const authorName = post ? (post.author_display_name === "" ? post.author_username : post.author_display_name) : "";
  const authorInitial = authorName.charAt(0).toUpperCase() || "·";
  const authorAvatar = post?.author_profile_url ?? "";
  const createdAt = post?.created_at ?? 0;
  const comments = post?.comments ?? 0;
  const readMinutes = readMinutesFromHtml(postHtml);

  const currentUsername = userContext.user?.username ?? "";
  const isAuthor = post !== null && currentUsername !== "" && post.author_username === currentUsername;
  const isPublic = post?.visibility?.toUpperCase() === "PUBLIC";
  const isSignedOut = userContext.user === null;

  const seoDescription = stripHtmlExcerpt(postHtml, 200);

  return (
    <>
      <SeoMeta title={postTitle} description={seoDescription} image={postImage} />

      <div className="post-arena" data-signed-out={dataBool(isSignedOut)}>
        {isSignedOut && (
          <div className="pd-refer-bar" data-show="false" data-tier="0" data-testid="post-refer-bar">
            <span className="pd-refer-bar__icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 10.5c-1.3-2.5-4.9-7.2-8.2-9.5C.7-1.2 0 .5 0 1.5c0 1.1.6 9.1 1 10.3.8 4 5.5 5.1 9.6 4.4-6.5 1.1-12.3 3.5-4.7 11.4 2.5 2.6 3.5-2.6 4-5.2.5 2.6 1.6 7.8 4 5.2 7.7-7.9 1.9-10.4-4.6-11.5 4 .7 8.8-.4 9.6-4.4.4-1.2 1-9.2 1-10.3 0-1-.7-2.7-3.8-.5-3.3 2.3-6.9 7-8.2 9.6z" />
              </svg>
            </span>
            <span className="pd-refer-bar__text pd-refer-bar__text--bluesky">{tr.referTextBluesky}</span>
            <span className="pd-refer-bar__text pd-refer-bar__text--linkedin">{tr.referTextLinkedin}</span>
            <span className="pd-refer-bar__text pd-refer-bar__text--threads">{tr.referTextThreads}</span>
            <span className="pd-refer-bar__text pd-refer-bar__text--generic">{tr.referTextGeneric}</span>
            <button className="pd-refer-bar__close" aria-label={tr.referCloseAria}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {isSignedOut && (
          <div className="pd-brand-bar">
            <Link to="/" className="pd-brand">
              <span className="pd-brand__dot">R</span>
              Ratel
            </Link>
            <div className="pd-brand-bar__actions">
              <Link to="/" className="pd-brand-btn" data-testid="post-brand-signin">
                {tr.brandSignin}
              </Link>
              <Link to="/" className="pd-brand-btn pd-brand-btn--primary" data-testid="post-brand-get-started">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="5 12 19 12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                {tr.brandGetStarted}
              </Link>
            </div>
          </div>
        )}

        {!isSignedOut && (
          <div className="arena-topbar">
            <div className="arena-topbar__left">
              <button className="back-btn" aria-label={tr.btnBackAria} onClick={() => nav(-1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="topbar-title">
                <span className="topbar-title__eyebrow">{tr.topbarEyebrow}</span>
                <span className="topbar-title__main">{tr.topbarMain}</span>
              </div>
            </div>
            <div className="arena-topbar__right">
              {canEdit && (
                <button className="topbar-btn" onClick={() => nav(`/posts/${postId}/edit`)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                  </svg>
                  {tr.btnEdit}
                </button>
              )}
              <button className="topbar-btn" onClick={() => void share()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {tr.btnShare}
              </button>
            </div>
          </div>
        )}

        <main className="page">
          <article className="post-hero">
            <div className="post-hero__meta">
              <span className="post-hero__avatar">
                {authorAvatar !== "" ? <img src={authorAvatar} alt={authorName} /> : authorInitial}
              </span>
              <div className="post-hero__author">
                <span className="post-hero__author-name">{authorName}</span>
                <span className="post-hero__author-time">{formatPublished(tr, createdAt, readMinutes)}</span>
              </div>
            </div>

            <h1 className="post-hero__title">{postTitle}</h1>

            {postImage !== "" && (
              <figure className="post-hero__image">
                <img src={postImage} alt={postTitle} />
              </figure>
            )}

            {/* SAFETY: post_html is server-sanitized in update_post_handler before
                persistence (Tiptap editor output -> server-side allowlist filter). */}
            <div className="post-hero__body" dangerouslySetInnerHTML={{ __html: postHtml }} />

            {postAttachments.length > 0 && (
              <div className="post-hero__attachments">
                {postAttachments.map((file) => (
                  <a key={file.id} className="post-hero__attachment" href={file.url ?? ""} target="_blank" rel="noreferrer">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-3 h-3 [&>path]:stroke-current"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
                    </svg>
                    <span className="post-hero__attachment-name">{file.name}</span>
                    <span className="post-hero__attachment-size">{file.size}</span>
                  </a>
                ))}
              </div>
            )}

            <div className="post-hero__actions">
              <button className="action-btn" data-active={dataBool(liked)} onClick={toggleLike}>
                <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <strong>{likeCount}</strong> {tr.actionLikesSuffix}
              </button>
              <button className="action-btn" onClick={() => setCommentsOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <strong>{comments}</strong> {tr.actionCommentsSuffix}
              </button>
            </div>
          </article>

          {isAuthor && isPublic && <SyndicationPanel postId={postId} />}

          {isSignedOut && (
            <aside className="pd-side">
              <div className="pd-house-card">
                <span className="pd-house-card__eyebrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  {tr.houseCardEyebrow}
                </span>
                <div className="pd-house-card__hero">
                  <span className="pd-house-card__hero-avatar">
                    {authorAvatar !== "" ? <img src={authorAvatar} alt={authorName} /> : authorInitial}
                  </span>
                  <div className="pd-house-card__hero-body">
                    <span className="pd-house-card__hero-title">
                      {authorName}
                      {tr.houseCardHeroTitleSuffix}
                    </span>
                    <span className="pd-house-card__hero-sub">{tr.houseCardHeroSub}</span>
                  </div>
                </div>
                <p className="pd-house-card__pitch">{tr.houseCardPitch}</p>
                <Link to="/" className="pd-house-card__cta" data-testid="post-house-subscribe">
                  {tr.houseCardCta}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 12 19 12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
                <p className="pd-house-card__note">{tr.houseCardNote}</p>
              </div>
              <div className="pd-mcp-card">
                <div className="pd-mcp-card__head">
                  <span className="pd-mcp-card__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  </span>
                  <span className="pd-mcp-card__title">{tr.mcpCardTitle}</span>
                </div>
                <p className="pd-mcp-card__body">
                  {tr.mcpCardBodyLead} <code>{tr.mcpCardBodyEndpoint}</code> {tr.mcpCardBodyTail}
                </p>
              </div>
            </aside>
          )}

          {isSignedOut && (
            <section className="pd-subscribe-cta">
              <span className="pd-subscribe-cta__eyebrow">{tr.subscribeCtaEyebrow}</span>
              <h2 className="pd-subscribe-cta__title">{tr.subscribeCtaTitle}</h2>
              <p className="pd-subscribe-cta__sub">{tr.subscribeCtaSub}</p>
              <div className="pd-subscribe-cta__row">
                <Link to="/" className="pd-subscribe-cta__btn pd-subscribe-cta__btn--primary" data-testid="post-subscribe-primary">
                  {tr.subscribeCtaPrimary}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 12 19 12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
                <Link to="/" className="pd-subscribe-cta__btn pd-subscribe-cta__btn--ghost" data-testid="post-subscribe-secondary">
                  {tr.subscribeCtaSecondary}
                </Link>
              </div>
            </section>
          )}
        </main>

        {commentsOpen && (
          <>
            <div className="pd-drawer-backdrop" onClick={() => setCommentsOpen(false)} />
            <div className="pd-drawer-wrap">
              <PostCommentsPanel tr={tr} postDetail={pd} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
