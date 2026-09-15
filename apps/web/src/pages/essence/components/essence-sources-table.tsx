import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEssenceSourcesI18n } from "@/i18n/generated/features/essence/pages/sources/essence-sources.i18n";
import { dataBool } from "@/lib/dom";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";
import type { EssenceResponse, EssenceSourceKind } from "../hooks/essence-api";
import { PAGE_SIZE, useEssenceSources } from "../hooks/use-essence-sources";
import { formatRelativeTime, formatThousands, stripHtmlTags } from "./format";

// app/ratel/src/features/essence/pages/sources/sources_table/component.rs

export function EssenceSourcesTable() {
  const tr = useEssenceSourcesI18n();
  const { items, searchQuery, stats, selectedKind, pageIndex, hasNext, goToPage } = useEssenceSources();

  // Search narrows the current page only (server-driven pagination).
  const query = searchQuery.toLowerCase();
  const pageRows =
    query === ""
      ? items
      : items.filter((s) => s.title.toLowerCase().includes(query) || s.source_path.toLowerCase().includes(query));

  // Stats-backed total for the active chip, never less than what pagination has shown.
  const statsTotal = Math.max(
    {
      All: stats.total_sources,
      Notion: stats.total_notion,
      Post: stats.total_post,
      Comment: stats.total_comment,
      Poll: stats.total_poll,
      Quiz: stats.total_quiz,
    }[selectedKind],
    0,
  );
  const total = Math.max(statsTotal, pageIndex * PAGE_SIZE + items.length);
  const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE);

  return (
    <section className="essence-sources">
      <header className="essence-src-head">
        <span />
        <span>{tr.colTitle}</span>
        <span>{tr.colWords}</span>
        <span>{tr.colLastSync}</span>
        <span />
      </header>

      {/* Empty state follows the loaded page, not the (possibly lagging) stats. */}
      {pageRows.length === 0 ? <EmptyState /> : pageRows.map((source) => <SourceRow key={source.id} source={source} />)}

      <Pagination
        pageIndex={pageIndex}
        pageSize={PAGE_SIZE}
        total={total}
        onPrev={() => {
          if (pageIndex > 0) goToPage(pageIndex - 1);
        }}
        onNext={() => {
          if (pageIndex + 1 < totalPages || hasNext) goToPage(pageIndex + 1);
        }}
        onPage={goToPage}
      />
    </section>
  );
}

/** Rust `kind_class` — the icon modifier per source kind. */
const KIND_ICON_CLASS: Record<EssenceSourceKind, string> = {
  Notion: "essence-src-icon essence-src-icon--notion",
  Post: "essence-src-icon essence-src-icon--post",
  PostComment: "essence-src-icon essence-src-icon--comment",
  DiscussionComment: "essence-src-icon essence-src-icon--comment",
  Poll: "essence-src-icon essence-src-icon--action",
  Quiz: "essence-src-icon essence-src-icon--action",
  FactFoldRationale: "essence-src-icon essence-src-icon--post",
};

/**
 * Rust `navigation_target`: the page a row opens, or `null` for kinds with no
 * detail page. `source_pk` / `space_pk` are raw partitions ("FEED#abc").
 */
function navigationTarget(source: EssenceResponse): string | null {
  const idOf = (pk: string | null | undefined) => {
    if (!pk) return null;
    const i = pk.indexOf("#");
    return i === -1 ? null : pk.slice(i + 1);
  };
  const sourceId = idOf(source.source_pk);
  const spaceId = idOf(source.space_pk);
  switch (source.source_kind) {
    case "Post":
    case "PostComment":
      return sourceId === null ? null : `/posts/${sourceId}`;
    case "Poll":
    case "Quiz":
      return sourceId === null ? null : `/spaces/${sourceId}`;
    case "DiscussionComment":
      return spaceId === null ? null : `/spaces/${spaceId}`;
    case "Notion":
    case "FactFoldRationale":
      return null;
  }
}

/** One id per row for the dismissal anchor (Rust: `essence-src-menu-{uuid v7}`). */
function newMenuDomId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `essence-src-menu-${uuid}`;
}

function SourceRow({ source }: { source: EssenceResponse }) {
  const tr = useEssenceSourcesI18n();
  const { deleteEssence } = useEssenceSources();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuDomId] = useState(newMenuDomId);
  const menuWrap = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(menuWrap, menuOpen, setMenuOpen);

  const target = navigationTarget(source);

  // Every row gets a kind badge; comment rows add a tinted modifier. The
  // trailing space of the unmodified class string is the Rust output.
  const [badgeLabel, badgeClass] = ((): [string, string] => {
    switch (source.source_kind) {
      case "Notion":
        return [tr.tagNotion, "essence-src-meta__badge "];
      case "Post":
      case "FactFoldRationale":
        return [tr.tagPost, "essence-src-meta__badge "];
      case "PostComment":
        return [tr.tagPostComment, "essence-src-meta__badge essence-src-meta__badge--comment"];
      case "Poll":
        return [tr.tagPoll, "essence-src-meta__badge "];
      case "Quiz":
        return [tr.tagQuiz, "essence-src-meta__badge "];
      case "DiscussionComment":
        return [tr.tagDiscussionComment, "essence-src-meta__badge essence-src-meta__badge--discussion"];
    }
  })();

  return (
    <div
      className="essence-src-row"
      data-clickable={dataBool(target !== null)}
      onClick={() => {
        if (target !== null) navigate(target);
      }}
    >
      <span className={KIND_ICON_CLASS[source.source_kind]}>
        <KindIcon kind={source.source_kind} />
      </span>

      <div className="essence-src-title-wrap">
        {/* Older rows may still carry markup in the title. */}
        <span className="essence-src-title">{stripHtmlTags(source.title)}</span>
        <span className="essence-src-meta">
          <span className={badgeClass}>{badgeLabel}</span>
        </span>
      </div>

      <span className="essence-src-words">{formatThousands(source.word_count)}</span>
      <span className="essence-src-synced">{formatRelativeTime(source.updated_at)}</span>

      <div className="essence-src-menu-wrap" id={menuDomId} ref={menuWrap} onClick={(e) => e.stopPropagation()}>
        <button
          className="essence-src-more"
          aria-label={tr.rowMoreLabel}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
        {menuOpen && (
          <div className="essence-src-menu">
            <button
              className="essence-src-menu__item essence-src-menu__item--danger"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                deleteEssence(source.id);
              }}
            >
              {tr.menuDelete}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function KindIcon({ kind }: { kind: EssenceSourceKind }) {
  switch (kind) {
    case "Notion":
      return <>N</>;
    case "Post":
    // FOF rationale reuses the post icon in v1.
    case "FactFoldRationale":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
        </svg>
      );
    case "PostComment":
    case "DiscussionComment":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "Poll":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "Quiz":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}

interface PaginationProps {
  pageIndex: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (page: number) => void;
}

/**
 * Rust `compact_page_numbers`: up to 10 consecutive numbers for the window the
 * current page falls in (0–9, 10–19, …). Its `Ellipsis` entry is never emitted.
 */
function compactPageNumbers(current: number, totalPages: number): number[] {
  const WINDOW_SIZE = 10;
  if (totalPages === 0) return [];
  const start = Math.floor(current / WINDOW_SIZE) * WINDOW_SIZE;
  const end = Math.min(start + WINDOW_SIZE, totalPages);
  const pages: number[] = [];
  for (let p = start; p < end; p++) pages.push(p);
  return pages;
}

function Pagination({ pageIndex, pageSize, total, onPrev, onNext, onPage }: PaginationProps) {
  const tr = useEssenceSourcesI18n();
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  const shownStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const shownEnd = total === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="essence-pagination">
      <span className="essence-pagination__info">
        {`${tr.paginationPrefix} `}
        <strong>{`${shownStart} – ${shownEnd}`}</strong>
        {` ${tr.paginationOf} `}
        <strong>{formatThousands(total)}</strong>
      </span>
      <div className="essence-pagination__actions">
        <button className="essence-page-btn" aria-label={tr.paginationPrevious} disabled={pageIndex === 0} onClick={onPrev}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {compactPageNumbers(pageIndex, totalPages).map((p) => (
          <button
            key={`p-${p}`}
            className="essence-page-btn"
            // Rust renders `aria-current=""` on the other pages (not absent);
            // React's typing has no empty-string member, hence the cast.
            aria-current={(p === pageIndex ? "page" : "") as "page"}
            onClick={() => onPage(p)}
          >
            {p + 1}
          </button>
        ))}
        <button
          className="essence-page-btn"
          aria-label={tr.paginationNext}
          disabled={pageIndex + 1 >= totalPages}
          onClick={onNext}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  const tr = useEssenceSourcesI18n();
  return (
    <div className="essence-empty">
      <span className="essence-empty__title">{tr.emptyTitle}</span>
      <span className="essence-empty__sub">{tr.emptySubtitle}</span>
    </div>
  );
}
