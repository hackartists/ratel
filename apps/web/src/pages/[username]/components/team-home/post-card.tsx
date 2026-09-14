import { useNavigate } from "react-router-dom";
import type { PostResponse } from "@ratel/ts-bridges";
import { categoryModifier, formatPostDate } from "./format";
import { contentToPlainText } from "./plain-text";
import { postUrl } from "./use-team-home";

// Rust hardcodes these outside translate! (app/ratel/src/features/social/pages/home/views/mod.rs).
const LIKES = "Likes"; // mod.rs:338
const COMMENTS = "Comments"; // mod.rs:342
const SHARES = "Shares"; // mod.rs:346
const REWARD = "reward"; // mod.rs:371
const READ_SPACE = "Read Space"; // mod.rs:376
const READ_POST = "Read Post"; // mod.rs:378

/** mod.rs `PostCard`. */
export function PostCard({ index, post }: { index: number; post: PostResponse }) {
  const navigate = useNavigate();
  const route = postUrl(post);
  const thumbnail = post.urls[0];
  const category = post.categories[0];
  const catModifier = categoryModifier(category);
  const preview = contentToPlainText(post.body);
  const reward = post.rewards !== null && post.rewards > 0 ? post.rewards : null;

  return (
    <article className="post-card" data-index={`${index}`} onClick={() => navigate(route)}>
      <div className="post-card__wave" />

      <div className="post-card__top">
        {category !== undefined ? (
          <span className={`post-card__cat ${catModifier}`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {category}
          </span>
        ) : (
          <span />
        )}
        <span className="post-card__date">{formatPostDate(post.created_at)}</span>
      </div>

      <div className="post-card__title">{post.title}</div>

      {thumbnail !== undefined && <img className="post-card__thumb" src={thumbnail} />}

      {preview !== "" && <p className="post-card__desc">{preview}</p>}

      <div className="post-card__stats">
        <div className="post-card__stat">
          <span className={post.liked ? "post-card__stat-value post-card__stat-value--liked" : "post-card__stat-value"}>
            {post.likes}
          </span>
          <span className="post-card__stat-label">{LIKES}</span>
        </div>
        <div className="post-card__stat">
          <span className="post-card__stat-value">{post.comments}</span>
          <span className="post-card__stat-label">{COMMENTS}</span>
        </div>
        <div className="post-card__stat">
          <span className="post-card__stat-value">{post.shares}</span>
          <span className="post-card__stat-label">{SHARES}</span>
        </div>
      </div>

      {post.categories.length > 0 && (
        <div className="post-card__chips">
          {post.categories.map((c) => (
            <span key={`${post.pk}-${c}`} className="post-card__chip">
              {`#${c}`}
            </span>
          ))}
        </div>
      )}

      <div className="post-card__footer">
        {reward !== null && (
          <div className="post-card__reward">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12" />
              <path d="M16 10H8" />
            </svg>
            {`${reward} `}
            <small>{REWARD}</small>
          </div>
        )}
        <span className="post-card__cta">
          {post.space_pk !== null ? READ_SPACE : READ_POST}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </article>
  );
}
