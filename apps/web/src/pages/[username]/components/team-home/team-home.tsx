import * as React from "react";
import { useTeamArena } from "@/components/social/team-arena-context";
import { InfiniteMore } from "@/components/ui/infinite-more";
import { useHomeI18n } from "./i18n";
import { deriveCategorySummary, formatSince } from "./format";
import { CatFilter, HudStat } from "./hud";
import { PostCard } from "./post-card";
import { useCreateTeamPost, useTeamHomeFeed } from "./use-team-home";

// app/ratel/src/features/social/pages/home/views/mod.rs (`Home`, rendered as
// `TeamHome` by `SocialIndex` on team walls). Rust keeps its carousel
// `document::Script` commented out (mod.rs:48), so no page script is loaded:
// the `.carousel-dots` container stays empty and no card gets `.active`.
export function TeamHome({ username }: { username: string }) {
  const t = useHomeI18n();
  const arena = useTeamArena();
  const createPost = useCreateTeamPost();

  const descriptionHtml = arena.description;
  const createdAt = arena.createdAt;
  const canEdit = arena.canEdit;

  // mod.rs:24 — a page-local `use_signal(|| None)`, not the layout's
  // category context: it resets whenever the home remounts.
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  // While the filtered first page loads, keep showing the loaded feed (the
  // Rust loader keeps its last value) instead of suspending the page.
  const queryCategory = React.useDeferredValue(selectedCategory);
  const feed = useTeamHomeFeed(username, queryCategory);

  const items = feed.items;
  const categorySummary = deriveCategorySummary(items);
  const totalPosts = items.length;
  const totalLikes = items.reduce((sum, p) => sum + p.likes, 0);
  const totalComments = items.reduce((sum, p) => sum + p.comments, 0);

  return (
    <div className="home-arena" data-testid="team-home-arena">
      {/* Team intro strip */}
      <div className="team-intro">
        {descriptionHtml !== "" ? (
          <div className="team-intro__desc" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
        ) : (
          <div className="team-intro__desc">{t.noDescription}</div>
        )}
        <div className="team-intro__meta">
          <span className="team-intro__chip">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {`${t.sinceLabel} `}
            <strong>{formatSince(createdAt)}</strong>
          </span>
        </div>
      </div>

      {/* Section label */}
      <div className="home-section-label">
        <span className="home-section-label__dash" />
        <span className="home-section-label__title">
          {`${t.teamLabel} `}
          <strong>{t.postsLabel}</strong>
        </span>
        <span className="home-section-label__dash" />
      </div>

      {/* Carousel / empty state */}
      <div className="home-feed-region">
        {items.length === 0 ? (
          <div className="home-empty-state" data-testid="team-home-empty">
            <div className="home-empty-state__title">{t.noPosts}</div>
            <span className="home-empty-state__desc">{t.noPostsDesc}</span>
          </div>
        ) : (
          <div className="carousel-wrapper">
            <div className="carousel-track">
              {items.map((post, idx) => (
                <PostCard key={post.pk} index={idx} post={post} />
              ))}
            </div>
            <div className="carousel-dots" />
          </div>
        )}
      </div>

      {/* Infinite-scroll trigger (hidden unless more pages exist) */}
      {feed.hasMore && <InfiniteMore hasMore={feed.hasMore} loading={feed.loading} onMore={feed.next} />}

      {/* Bottom bar */}
      <div className="home-bottom-bar">
        <div className="home-bottom-bar__row">
          <HudStat
            label={t.postsLoaded}
            valueMain={`${totalPosts}`}
            accent={false}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            }
          />
          <HudStat
            label={t.likesLabel}
            valueMain={`${totalLikes}`}
            valueSmall={t.onPageLabel}
            accent
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            }
          />
          <HudStat
            label={t.commentsLabel}
            valueMain={`${totalComments}`}
            valueSmall={t.onPageLabel}
            accent={false}
            icon={
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
            }
          />
          {canEdit && (
            <button
              className="home-browse-btn"
              type="button"
              data-testid="team-home-create-post"
              onClick={() => void createPost()}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t.createPost}
            </button>
          )}
        </div>

        {categorySummary.length > 0 && (
          <div className="home-bottom-bar__row home-bottom-bar__row--filters">
            <div className="cat-filters">
              <CatFilter
                label={t.allLabel}
                count={totalPosts}
                active={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
              />
              {categorySummary.map(([name, count]) => (
                <CatFilter
                  key={`cat-${name}`}
                  label={name}
                  count={count}
                  active={selectedCategory === name}
                  onClick={() => setSelectedCategory((current) => (current === name ? null : name))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
