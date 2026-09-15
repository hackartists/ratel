import { useNavigate } from "react-router-dom";
import type { PostResponse } from "@ratel/ts-bridges";
import { useHomeArenaI18n } from "./i18n";
import { contentBodyToHtml } from "@/lib/content-body";
import { formatPostDate } from "./format";

// app/ratel/src/views/index/component.rs `HomePostCard` (lines 1068-1178) — one
// "My Posts" slide, reusing the `.space-card` frame (`--post` variant, the
// `--rising` badge tone). "View Post" always opens the post detail page.

/** component.rs:1083 */
const UNTITLED = "Untitled";

export function HomePostCard({ post, active = false }: { post: PostResponse; active?: boolean }) {
  const t = useHomeArenaI18n();
  const navigate = useNavigate();
  const title = post.title.trim() === "" ? UNTITLED : post.title;
  const date = formatPostDate(post.created_at);
  const author = post.author_display_name.trim() === "" ? `@${post.author_username}` : post.author_display_name;
  const category = post.categories[0] ?? "";
  const badgeLabel = category === "" ? t.postBadge : category;

  return (
    <div className={`space-card space-card--rising space-card--post${active ? " active" : ""}`} data-testid={`home-post-${post.pk}`}>
      <div className="space-card__wave" />

      <div className="space-card__top">
        <span className="space-card__heat space-card__heat--rising">
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {badgeLabel}
        </span>
        <span className="space-card__rank">{date}</span>
      </div>

      <div className="space-card__identity">
        <img className="space-card__logo" src={post.author_profile_url} alt="" />
        <div className="space-card__id">
          <span className="space-card__category">{author}</span>
          <span className="space-card__title">{title}</span>
        </div>
      </div>

      <div className="space-card__desc" dangerouslySetInnerHTML={{ __html: contentBodyToHtml(post.body) }} />

      <div className="space-card__stats">
        <div className="space-stat">
          <span className="space-stat__value">{post.likes}</span>
          <span className="space-stat__label">{t.statLikes}</span>
        </div>
        <div className="space-stat">
          <span className="space-stat__value">{post.comments}</span>
          <span className="space-stat__label">{t.statComments}</span>
        </div>
        <div className="space-stat">
          <span className="space-stat__value">{post.shares}</span>
          <span className="space-stat__label">{t.statShares}</span>
        </div>
      </div>

      <div className="space-card__footer">
        <div className="space-card__reward" />
        <button className="space-card__cta" onClick={() => navigate(`/posts/${post.pk}`)}>
          {t.viewPost}
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
