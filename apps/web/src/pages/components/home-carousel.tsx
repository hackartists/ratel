import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { HotSpaceResponse, PostResponse } from "@ratel/ts-bridges";
import { useHomeArenaI18n } from "@/i18n/generated/views/index/home-arena.i18n";
import { dataBool } from "@/lib/dom";
import { ArenaSpaceCard } from "./arena-space-card";
import {
  cardCategory,
  cardLogo,
  cardTitle,
  chipsFor,
  formatCount,
  formatThousands,
  heatCss,
  heatLabel,
  rankText,
} from "./format";
import { HomePostCard } from "./home-post-card";

// app/ratel/src/views/index/component.rs:488-613 — section label, the signed-in
// tabs, and the carousel (spaces or "My Posts") or its empty state. The track
// and dots keep `#home-carousel-track` / `#home-carousel-dots`, which the page
// script binds to for scroll-snap focus and dot navigation.

export const HomeTab = {
  Hot: "hot",
  Mine: "mine",
  Invited: "invited",
  Posts: "posts",
} as const;
export type HomeTab = (typeof HomeTab)[keyof typeof HomeTab];

export interface HomeCarouselProps {
  hasUser: boolean;
  tab: HomeTab;
  onTab: (tab: HomeTab) => void;
  cards: HotSpaceResponse[];
  posts: PostResponse[];
}

export function HomeCarousel({ hasUser, tab, onTab, cards, posts }: HomeCarouselProps) {
  const t = useHomeArenaI18n();
  const navigate = useNavigate();

  let body: ReactNode;
  if (tab === HomeTab.Posts) {
    body =
      posts.length === 0 ? (
        <div className="home-arena__empty">{t.emptyPosts}</div>
      ) : (
        <>
          <div className="carousel-wrapper">
            <div className="carousel-track" id="home-carousel-track">
              {posts.map((post, i) => (
                <HomePostCard key={post.pk} post={post} active={i === 0} />
              ))}
            </div>
          </div>
          <div className="carousel-dots" id="home-carousel-dots">
            {posts.map((post) => (
              <button key={post.pk} className="carousel-dot" />
            ))}
          </div>
        </>
      );
  } else if (cards.length === 0) {
    body = (
      <div className="home-arena__empty">
        {tab === HomeTab.Mine ? t.emptyMine : tab === HomeTab.Invited ? t.emptyInvited : t.emptyHot}
      </div>
    );
  } else {
    body = (
      <>
        <div className="carousel-wrapper">
          <div className="carousel-track" id="home-carousel-track">
            {cards.map((card, i) => (
              <ArenaSpaceCard
                key={card.space_id}
                active={i === 0}
                heat={heatCss(card.heat)}
                rank={rankText(card.rank)}
                logo={cardLogo(card)}
                category={cardCategory(card)}
                title={cardTitle(card)}
                description={card.description}
                members={formatCount(card.participants)}
                quests={String(card.total_actions)}
                heatDelta={heatLabel(card.total_actions)}
                chips={chipsFor(card)}
                rewardAmount={formatThousands(card.rewards)}
                onEnter={() => navigate(`/spaces/${card.space_id}`)}
              />
            ))}
          </div>
        </div>

        <div className="carousel-dots" id="home-carousel-dots">
          {cards.map((card) => (
            <button key={card.space_id} className="carousel-dot" data-heat={heatCss(card.heat)} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="section-label">
        <span className="section-label__dash" />
        <span className="section-label__title">
          <strong>{t.sectionHot}</strong>
          {` ${t.sectionSpaces}`}
        </span>
        <span className="section-label__dash" />
      </div>

      {hasUser && (
        <div className="section-tabs">
          <button className="section-tab" aria-selected={dataBool(tab === HomeTab.Hot)} data-testid="home-tab-hot" onClick={() => onTab(HomeTab.Hot)}>
            {t.tabHot}
          </button>
          <button className="section-tab" aria-selected={dataBool(tab === HomeTab.Mine)} data-testid="home-tab-mine" onClick={() => onTab(HomeTab.Mine)}>
            {t.tabMine}
          </button>
          <button
            className="section-tab"
            aria-selected={dataBool(tab === HomeTab.Invited)}
            data-testid="home-tab-invited"
            onClick={() => onTab(HomeTab.Invited)}
          >
            {t.tabInvited}
          </button>
          <button className="section-tab" aria-selected={dataBool(tab === HomeTab.Posts)} data-testid="home-tab-posts" onClick={() => onTab(HomeTab.Posts)}>
            {t.tabPosts}
          </button>
        </div>
      )}

      {body}
    </>
  );
}
