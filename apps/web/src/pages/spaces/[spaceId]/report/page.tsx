import { useNavigate, useParams } from "react-router-dom";
import type { ReportListItem, ReportStatus } from "@ratel/ts-bridges";
import { isSpaceAdmin, useSpaceContext } from "@/components/space/space-context";
import {
  useReportListI18n,
  type ReportListI18n,
} from "@/i18n/generated/features/spaces/pages/report/views/report-list.i18n";
import { dataBool } from "@/lib/dom";
import { useLegacyScript } from "@/lib/legacy-scripts";
import listScript from "../../../../legacy-scripts/features/spaces/pages/report/views/script.js?url&no-inline";
import { ReportListProvider, useReportList, useReportListContext } from "./hooks/use-report-list";

// app/ratel/src/features/spaces/pages/report/views/{mod.rs,list_page.rs}
// (`SpaceReportPage` → `ReportListPage`). Carousel list of the space's
// reports. Admin chrome (NEW REPORT, filter chips, Drafts counter, create
// card, card menus) only renders for editors; access is enforced server-side.

export function Component() {
  const { spaceId = "" } = useParams();
  const ctrl = useReportList(spaceId);
  return (
    <ReportListProvider value={ctrl}>
      <ReportListPage />
    </ReportListProvider>
  );
}

function ReportListPage() {
  const tr = useReportListI18n();
  const navigate = useNavigate();
  const ctx = useReportListContext();
  const { role } = useSpaceContext();
  const editable = isSpaceAdmin(role);
  useLegacyScript(listScript);

  return (
    <div className="reports-arena">
      <div className="reports-topbar">
        <div className="reports-topbar__brand">
          <button className="reports-topbar__back" aria-label={tr.backAria} onClick={() => navigate(-1)}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="reports-topbar__divider" />
          <div className="reports-topbar__logo">{tr.workspaceLogo}</div>
          <div className="reports-topbar__title-col">
            <span className="reports-topbar__title">{tr.workspaceTitle}</span>
          </div>
        </div>
        <div className="reports-topbar__actions">
          {editable && (
            <button
              className="reports-topbar__btn reports-topbar__btn--primary"
              aria-label={tr.newReportAria}
              aria-busy={dataBool(ctx.createPending)}
              disabled={ctx.createPending}
              onClick={() => {
                if (!ctx.createPending) ctx.handleCreate();
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
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{tr.newReportBtn}</span>
            </button>
          )}
        </div>
      </div>

      <div className="section-label">
        <span className="section-label__dash" />
        <span className="section-label__title">
          <strong>{tr.sectionTitle}</strong>
        </span>
        <span className="section-label__dash" />
      </div>
      <div className="section-stats">
        <span>
          <strong>{String(ctx.totalCount)}</strong>
          {tr.statTotal}
        </span>
        {editable && (
          <span>
            <strong>{String(ctx.draftsCount)}</strong>
            {tr.statDrafts}
          </span>
        )}
        <span>
          <strong>{String(ctx.publishedCount)}</strong>
          {tr.statPublished}
        </span>
      </div>

      {editable && (
        <div className="reports-filters">
          <button
            className="reports-chip"
            data-filter="all"
            aria-selected={dataBool(ctx.filter === "All")}
            onClick={() => ctx.setFilter("All")}
          >
            {tr.filterAll}
          </button>
          <button
            className="reports-chip"
            data-filter="drafts"
            aria-selected={dataBool(ctx.filter === "Drafts")}
            onClick={() => ctx.setFilter("Drafts")}
          >
            {tr.filterDrafts}
          </button>
          <button
            className="reports-chip"
            data-filter="published"
            aria-selected={dataBool(ctx.filter === "Published")}
            onClick={() => ctx.setFilter("Published")}
          >
            {tr.filterPublished}
          </button>
        </div>
      )}

      <div className="carousel-wrapper">
        <div className="carousel-track" id="carousel-track">
          {editable && <ReportCreateCard />}
          {ctx.items.map((item, idx) => (
            <ReportCard key={item.id} idx={idx + 1} item={item} editable={editable} />
          ))}
        </div>
        <div className="carousel-dots" id="carousel-dots" />
      </div>

      <DeleteConfirmModal />
    </div>
  );
}

function DeleteConfirmModal() {
  const tr = useReportListI18n();
  const ctx = useReportListContext();
  const target = ctx.deleteTarget;
  if (target === null) return null;
  const pending = ctx.deletePending;

  return (
    <div
      className="confirm-modal"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!pending) ctx.cancelDelete();
      }}
    >
      <div className="confirm-modal__panel" onClick={(e) => e.stopPropagation()}>
        <span className="confirm-modal__eyebrow">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          {tr.modalEyebrow}
        </span>
        <div className="confirm-modal__icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </div>
        <div className="confirm-modal__title">{tr.modalTitle}</div>
        <div className="confirm-modal__body">
          <strong>{target.title}</strong>
          {tr.modalBody}
          <span className="confirm-modal__note">{tr.modalNote}</span>
        </div>
        <div className="confirm-modal__actions">
          <button
            className="confirm-modal__btn confirm-modal__btn--ghost"
            type="button"
            disabled={pending}
            onClick={ctx.cancelDelete}
          >
            {tr.modalCancel}
          </button>
          <button
            className="confirm-modal__btn confirm-modal__btn--danger"
            type="button"
            disabled={pending}
            onClick={() => {
              if (!pending) ctx.handleDelete();
            }}
          >
            {tr.modalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCreateCard() {
  const tr = useReportListI18n();
  const ctx = useReportListContext();
  return (
    <a
      className="report-card report-card--create"
      href="#"
      data-index="0"
      data-kind="create"
      aria-busy={dataBool(ctx.createPending)}
      onClick={(e) => {
        e.preventDefault();
        if (!ctx.createPending) ctx.handleCreate();
      }}
    >
      <div className="report-card__wave" />
      <div className="report-card__create-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <div className="report-card__create-title">{tr.createTitle}</div>
      <div className="report-card__create-sub">
        {tr.createSubPrefix}
        <code>/data:</code>
        {tr.createSubSuffix}
      </div>
      <span className="report-card__create-cta">
        {tr.createCta}
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
    </a>
  );
}

function ReportCard({ idx, item, editable }: { idx: number; item: ReportListItem; editable: boolean }) {
  const tr = useReportListI18n();
  const ctx = useReportListContext();
  const navigate = useNavigate();
  const menuOpen = ctx.isMenuOpenFor(item.id);

  return (
    <div
      className="report-card"
      role="link"
      tabIndex={0}
      onClick={() => {
        // Menu open, or a delete confirm just opened from the menu: don't navigate.
        if (ctx.isMenuOpenFor(item.id)) return;
        if (ctx.deleteTarget !== null) return;
        navigate(`/spaces/${ctx.spaceId}/report/${item.id}`);
      }}
      data-index={String(idx)}
    >
      <div className="report-card__wave" />
      <div className="report-card__top">
        <span
          className={
            item.status === "PUBLISHED"
              ? "report-card__badge report-card__badge--published"
              : "report-card__badge report-card__badge--draft"
          }
        >
          <StatusIcon status={item.status} />
          {item.status === "PUBLISHED" ? tr.statusPublished : tr.statusDraft}
        </span>
        {editable && (
          <div className="report-card__menu-wrap">
            <button
              className="report-card__menu-btn"
              aria-label={tr.cardMenuAria}
              aria-haspopup="menu"
              aria-expanded={dataBool(menuOpen)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                ctx.toggleMenu(item.id);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            {menuOpen && (
              <div className="card-menu" role="menu">
                <button
                  className="card-menu__item card-menu__item--danger"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    ctx.requestDelete(item);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                  {tr.menuDelete}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="report-card__identity">
        <div className="report-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
          </svg>
        </div>
        <div className="report-card__id">
          {item.title.trim() === "" ? (
            <span className="report-card__title report-card__title--placeholder">{tr.cardTitlePlaceholder}</span>
          ) : (
            <span className="report-card__title">{item.title}</span>
          )}
        </div>
      </div>
      <div className="report-card__desc">{item.description}</div>
      <div className="report-card__spacer" />
      <div className="report-card__footer">
        <span className="report-card__meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {formatRelativeTime(item.created_at, tr)}
        </span>
        <span className="report-card__cta">
          {tr.cardOpenCta}
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
    </div>
  );
}

/** Client-side "Xm ago" label (`format_relative_time`). */
function formatRelativeTime(timestampMillis: number, tr: ReportListI18n): string {
  const diffMs = Math.max(Date.now() - timestampMillis, 0);
  if (diffMs < 60_000) return tr.timeJustNow;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}${tr.timeMinutesSuffix}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${tr.timeHoursSuffix}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${tr.timeDaysSuffix}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}${tr.timeWeeksSuffix}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}${tr.timeMonthsSuffix}`;
  return `${Math.floor(days / 365)}${tr.timeYearsSuffix}`;
}

function StatusIcon({ status }: { status: ReportStatus }) {
  return status === "PUBLISHED" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
