import * as React from "react";
import { useNavigate } from "react-router-dom";
import type { PostResponse } from "@ratel/ts-bridges";
import { InfiniteMore } from "@/components/ui/infinite-more";
import { dataBool } from "@/lib/dom";
import { useLegacyScript } from "@/lib/legacy-scripts";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";
import {
  useUserDraftsI18n,
  type UserDraftsI18n,
} from "./i18n";
import draftsScript from "../../../../legacy-scripts/features/social/pages/draft/user/views/script.js?url&no-inline";
import { formatCommas, timeAgo, toPlainText, wordCount } from "../hooks/draft-text";
import { partitionId } from "../hooks/use-drafts-list";
import { useUserDrafts } from "../hooks/use-user-drafts";
import { isVirtuallyStopped, stopVirtual } from "./virtual-stop";

// app/ratel/src/features/social/pages/draft/user/views/mod.rs (`Home`): the
// drafts arena — topbar, stats, filter chips, sort menu, bucketed draft cards.

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;

type Bucket = "today" | "week" | "older";
type Filter = "all" | "today" | "week" | "older" | "space";
type SortMode = "recent" | "oldest" | "title" | "words";

function bucketOf(updatedAt: number): Bucket {
  const diff = Date.now() - updatedAt;
  if (diff < DAY_MS) return "today";
  if (diff < WEEK_MS) return "week";
  return "older";
}

const hasSpace = (p: PostResponse) => p.space_pk !== null;

export function UserDrafts() {
  useLegacyScript(draftsScript);
  const tr = useUserDraftsI18n();
  const navigate = useNavigate();
  const { drafts, deleted, createPost, deleteDraft } = useUserDrafts();

  const [filter, setFilter] = React.useState<Filter>("all");
  const [sortMode, setSortMode] = React.useState<SortMode>("recent");
  const [sortOpen, setSortOpen] = React.useState(false);
  // Press anywhere outside the control closes it.
  const sortRef = React.useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(sortRef, sortOpen, setSortOpen);
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);

  const items = drafts.items.filter((post) => !deleted.has(post.pk));

  const allCount = items.length;
  const todayCount = items.filter((p) => bucketOf(p.updated_at) === "today").length;
  const weekCount = items.filter((p) => bucketOf(p.updated_at) === "week").length;
  const olderCount = items.filter((p) => bucketOf(p.updated_at) === "older").length;
  const spaceCount = items.filter(hasSpace).length;
  const totalWords = items.reduce((sum, p) => sum + wordCount(p.body), 0);
  const lastEdited = items.length > 0 ? Math.max(...items.map((p) => p.updated_at)) : null;
  const lastEditedText = lastEdited === null ? tr.timeNever : timeAgo(lastEdited);

  const filtered = items.filter((p) => {
    switch (filter) {
      case "all":
        return true;
      case "today":
        return bucketOf(p.updated_at) === "today";
      case "week":
        return bucketOf(p.updated_at) === "week";
      case "older":
        return bucketOf(p.updated_at) === "older";
      case "space":
        return hasSpace(p);
    }
  });

  const sorted = [...filtered];
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  switch (sortMode) {
    case "recent":
      sorted.sort((a, b) => b.updated_at - a.updated_at);
      break;
    case "oldest":
      sorted.sort((a, b) => a.updated_at - b.updated_at);
      break;
    case "title":
      sorted.sort((a, b) => cmp(a.title.toLowerCase(), b.title.toLowerCase()));
      break;
    case "words":
      sorted.sort((a, b) => wordCount(b.body) - wordCount(a.body));
      break;
  }

  const todayPosts = sorted.filter((p) => bucketOf(p.updated_at) === "today");
  const weekPosts = sorted.filter((p) => bucketOf(p.updated_at) === "week");
  const olderPosts = sorted.filter((p) => bucketOf(p.updated_at) === "older");

  const sortLabel = { recent: tr.sortRecent, oldest: tr.sortOldest, title: tr.sortTitle, words: tr.sortWords }[sortMode];
  const wordsFormatted = formatCommas(totalWords);

  const pickSort = (mode: SortMode) => {
    setSortMode(mode);
    setSortOpen(false);
  };

  const cardProps = {
    menuOpenId,
    setMenuOpenId,
    deleteDraft,
    tr,
    openEditor: (pk: string) => navigate(`/posts/${partitionId(pk)}/edit`),
  };

  return (
    <div className="drafts-arena">
      <div className="arena-topbar">
        <div className="arena-topbar__left">
          <button className="back-btn" aria-label={tr.back} onClick={() => navigate(-1)}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="topbar-title">
            <span className="topbar-title__main">{tr.pageTitle}</span>
            <span className="topbar-title__count">
              <strong>{allCount}</strong>
              {` ${tr.totalLabel}`}
            </span>
          </div>
        </div>
        <div className="arena-topbar__right">
          <button className="topbar-btn topbar-btn--primary" onClick={() => void createPost()}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {tr.newPost}
          </button>
        </div>
      </div>

      <div className="page">
        <div className="stats-strip">
          <div className="stat-card">
            <div className="stat-card__icon">
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
              </svg>
            </div>
            <div className="stat-card__body">
              <span className="stat-card__label">{tr.statTotal}</span>
              <span className="stat-card__value">{allCount}</span>
            </div>
          </div>
          <div className="stat-card stat-card--teal">
            <div className="stat-card__icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div className="stat-card__body">
              <span className="stat-card__label">{tr.statWords}</span>
              <span className="stat-card__value">
                {`${wordsFormatted} `}
                <small>{tr.unitWords}</small>
              </span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-card__body">
              <span className="stat-card__label">{tr.statLast}</span>
              <span className="stat-card__value">{lastEditedText}</span>
            </div>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-chips">
            <FilterChip label={tr.filterAll} count={allCount} selected={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip
              label={tr.filterToday}
              count={todayCount}
              selected={filter === "today"}
              onClick={() => setFilter("today")}
            />
            <FilterChip
              label={tr.filterWeek}
              count={weekCount}
              selected={filter === "week"}
              onClick={() => setFilter("week")}
            />
            <FilterChip
              label={tr.filterOlder}
              count={olderCount}
              selected={filter === "older"}
              onClick={() => setFilter("older")}
            />
            <FilterChip
              label={tr.filterSpace}
              count={spaceCount}
              selected={filter === "space"}
              onClick={() => setFilter("space")}
            />
          </div>
          <div className="sort" id="drafts-sort" data-open={dataBool(sortOpen)} ref={sortRef}>
            <button className="sort__btn" onClick={() => setSortOpen(!sortOpen)}>
              <small>{tr.sortLabel}</small>
              <span>{sortLabel}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className="sort__menu" role="listbox">
              <SortItem label={tr.sortRecent} selected={sortMode === "recent"} onClick={() => pickSort("recent")} />
              <SortItem label={tr.sortOldest} selected={sortMode === "oldest"} onClick={() => pickSort("oldest")} />
              <SortItem label={tr.sortTitle} selected={sortMode === "title"} onClick={() => pickSort("title")} />
              <SortItem label={tr.sortWords} selected={sortMode === "words"} onClick={() => pickSort("words")} />
            </div>
          </div>
        </div>

        {allCount === 0 ? (
          <EmptyState title={tr.emptyTitle} desc={tr.emptyDesc} cta={tr.emptyCta} onCta={() => void createPost()} />
        ) : sorted.length === 0 ? (
          <EmptyState
            title={tr.emptyFilteredTitle}
            desc={tr.emptyFilteredDesc}
            cta={tr.filterAll}
            onCta={() => setFilter("all")}
          />
        ) : (
          <>
            <DraftSection title={tr.sectionToday} posts={todayPosts} {...cardProps} />
            <DraftSection title={tr.sectionWeek} posts={weekPosts} {...cardProps} />
            <DraftSection title={tr.sectionOlder} posts={olderPosts} {...cardProps} />
          </>
        )}

        {drafts.hasMore && <InfiniteMore hasMore={drafts.hasMore} loading={drafts.loading} onMore={drafts.next} />}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className="chip" aria-selected={dataBool(selected)} onClick={onClick}>
      {label}
      <span className="chip__count">{count}</span>
    </button>
  );
}

function SortItem({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button className="sort__item" role="option" aria-selected={dataBool(selected)} onClick={onClick}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {label}
    </button>
  );
}

interface CardProps {
  menuOpenId: string | null;
  setMenuOpenId(id: string | null): void;
  deleteDraft(pk: string): Promise<void>;
  openEditor(pk: string): void;
  tr: UserDraftsI18n;
}

function DraftSection({ title, posts, ...cardProps }: CardProps & { title: string; posts: PostResponse[] }) {
  if (posts.length === 0) return null;
  return (
    <>
      <div className="section-label">
        <span className="section-label__title">{title}</span>
        <span className="section-label__line" />
      </div>
      <div className="drafts-list">
        {posts.map((post) => (
          <DraftCard key={post.pk} post={post} {...cardProps} />
        ))}
      </div>
    </>
  );
}

function DraftCard({ post, menuOpenId, setMenuOpenId, deleteDraft, openEditor, tr }: CardProps & { post: PostResponse }) {
  const pk = post.pk;
  const menuOpen = menuOpenId === pk;
  const isWriting = Date.now() - post.updated_at < 5 * 60 * 1000;

  const excerptTrim = toPlainText(post.body).trim();
  const excerptEmpty = excerptTrim === "";
  const excerptText = excerptEmpty ? tr.emptyExcerpt : [...excerptTrim].slice(0, 220).join("");

  const titleText = post.title.trim();
  const titleUntitled = titleText === "";
  const titleDisplay = titleUntitled ? tr.untitled : titleText;

  const words = wordCount(post.body);
  const imageCount = post.urls.length;
  const savedAgo = timeAgo(post.updated_at);
  const tags = post.categories;

  return (
    <div
      className={isWriting ? "draft-card draft-card--writing" : "draft-card"}
      data-menu-open={dataBool(menuOpen)}
      onClick={(e) => {
        if (isVirtuallyStopped(e)) return;
        openEditor(pk);
      }}
    >
      <div className="draft-card__dot">
        <span />
      </div>
      <div className="draft-card__body">
        <div className="draft-card__title-row">
          {titleUntitled ? (
            <span className="draft-card__title draft-card__title--untitled">{titleDisplay}</span>
          ) : (
            <span className="draft-card__title">{titleDisplay}</span>
          )}
          {isWriting && <span className="draft-card__badge draft-card__badge--writing">{tr.badgeWriting}</span>}
          {hasSpace(post) && (
            <span className="draft-card__badge draft-card__badge--space">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {tr.badgeSpace}
            </span>
          )}
        </div>
        {excerptEmpty ? (
          <p className="draft-card__excerpt draft-card__excerpt--empty">{excerptText}</p>
        ) : (
          <p className="draft-card__excerpt">{excerptText}</p>
        )}
        <div className="draft-card__meta">
          <span className="draft-card__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <strong>{words}</strong>
            {` ${tr.unitWords}`}
          </span>
          {imageCount > 0 && (
            <span className="draft-card__meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <strong>{imageCount}</strong>
              {` ${tr.metaImages}`}
            </span>
          )}
          <span className="draft-card__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {`${tr.metaSaved} `}
            <strong>{savedAgo}</strong>
          </span>
          {tags.length > 0 && (
            <span className="draft-card__tags">
              {tags.map((tag, i) => (
                <span key={i} className="draft-card__tag">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="draft-card__actions">
        <button
          className="draft-card__resume"
          onClick={(e) => {
            stopVirtual(e);
            openEditor(pk);
          }}
        >
          {tr.resume}
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
        </button>
        <button
          className="draft-card__more"
          aria-label={tr.moreOptions}
          onClick={(e) => {
            stopVirtual(e);
            setMenuOpenId(menuOpenId === pk ? null : pk);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>
      <div className="draft-menu" onClick={(e) => stopVirtual(e)}>
        <button
          className="draft-menu__item"
          onClick={(e) => {
            stopVirtual(e);
            setMenuOpenId(null);
            openEditor(pk);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {tr.menuResume}
        </button>
        <div className="draft-menu__separator" />
        <button
          className="draft-menu__item draft-menu__item--danger"
          onClick={(e) => {
            stopVirtual(e);
            setMenuOpenId(null);
            void deleteDraft(pk);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          </svg>
          {tr.menuDelete}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ title, desc, cta, onCta }: { title: string; desc: string; cta: string; onCta: () => void }) {
  // mod.rs:767-776 — `dx fmt` mangled `class: "empty-state__title", "{title}"`
  // into an empty class plus a custom element `<empty-state__title>` and a
  // literal "," text node. Reproduced verbatim for DOM parity.
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </div>
      <div className="">
        {title}
        {React.createElement("empty-state__title")}
        {","}
      </div>
      <div className="">
        {desc}
        {React.createElement("empty-state__desc")}
        {","}
      </div>
      <button className="empty-state__cta" onClick={onCta}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {cta}
      </button>
    </div>
  );
}
