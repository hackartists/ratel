import * as React from "react";
import { useNavigate } from "react-router-dom";
import type { PostResponse } from "@ratel/ts-bridges";
import { InfiniteMore } from "@/components/ui/infinite-more";
import { isAdminOrOwner, TeamArenaTab, useTeamArenaTab } from "@/components/social/team-arena-context";
import {
  useTeamDraftI18n,
  type TeamDraftI18n,
} from "@/i18n/generated/features/social/pages/draft/team/views/team-draft.i18n";
import { toPlainText } from "../hooks/draft-text";
import { partitionId } from "../hooks/use-drafts-list";
import { useTeamDrafts, useTeamDraftsPermission } from "../hooks/use-team-drafts";
import { ViewerPage } from "./viewer-page";
import { isVirtuallyStopped, stopVirtual } from "./virtual-stop";

// app/ratel/src/features/social/pages/draft/team/views/mod.rs (`Home`).

// Rust hardcodes these outside translate! (mod.rs:109, :196, :290, :365).
const TEAM_PREFIX = "Team ";
const CLOSE_LABEL = "Close";
const DELETE_DRAFT_LABEL = "Delete draft";
const NO_TIMESTAMP = "—";

export function TeamDrafts({ username }: { username: string }) {
  // Sync arena topbar tab.
  useTeamArenaTab(TeamArenaTab.Drafts);

  // Permission gate: only owners/admins see the drafts view.
  const perm = useTeamDraftsPermission(username);
  if (perm === null || !isAdminOrOwner(perm.role)) {
    return <ViewerPage username={username} />;
  }
  return <TeamDraftsAdmin username={username} teamPk={perm.team_pk} />;
}

function TeamDraftsAdmin({ username, teamPk }: { username: string; teamPk: string }) {
  const tr = useTeamDraftI18n();
  const { drafts, createPost, deleteDraft } = useTeamDrafts(username, teamPk);
  const items = drafts.items;
  const count = items.length;
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);

  const onConfirmDelete = async () => {
    if (deleteTarget === null) return;
    if (await deleteDraft(deleteTarget)) setDeleteTarget(null);
  };

  return (
    <>
      <div className="td-section-label">
        <span className="td-section-label__dash" />
        <span className="td-section-label__title">
          {TEAM_PREFIX}
          <strong>{tr.draftsLabel}</strong>
        </span>
        <span className="td-section-label__dash" />
      </div>

      <div className="td-page">
        <div className="td-page-header">
          <div className="td-page-header__left">
            <h1 className="td-page-header__title">{tr.draftsTitle}</h1>
            <span className="td-page-header__sub">
              <strong>{count}</strong>
              {` ${tr.draftsSubhead}`}
            </span>
          </div>
          <button className="td-btn-primary" type="button" onClick={() => void createPost()}>
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
            {tr.newPost}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="td-empty-state">
            <div className="td-empty-state__icon">
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
            <div className="td-empty-state__title">{tr.emptyTitle}</div>
            <div className="td-empty-state__desc">{tr.emptyDesc}</div>
          </div>
        ) : (
          <div className="td-grid">
            {items.map((draft) => (
              <DraftCard key={draft.pk} draft={draft} tr={tr} onDelete={(pk) => setDeleteTarget(pk)} />
            ))}
            <InfiniteMore hasMore={drafts.hasMore} loading={drafts.loading} onMore={drafts.next} />
          </div>
        )}
      </div>

      {deleteTarget !== null && (
        <div
          className="td-modal-overlay"
          onClick={(e) => {
            if (isVirtuallyStopped(e)) return;
            setDeleteTarget(null);
          }}
        >
          <div className="td-modal" onClick={(e) => stopVirtual(e)}>
            <div className="td-modal__header">
              <span className="td-modal__title">{tr.deleteTitle}</span>
              <button
                className="td-modal__close"
                type="button"
                aria-label={CLOSE_LABEL}
                onClick={() => setDeleteTarget(null)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="td-modal__body">
              <p className="td-modal__desc">
                {tr.deleteDescPre}
                <strong>{tr.deleteDescStrong}</strong>
                {tr.deleteDescPost}
              </p>
              <div className="td-modal__actions">
                <button className="td-modal__cancel" type="button" onClick={() => setDeleteTarget(null)}>
                  {tr.cancel}
                </button>
                <button className="td-modal__confirm-danger" type="button" onClick={() => void onConfirmDelete()}>
                  {tr.confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DraftCard({ draft, tr, onDelete }: { draft: PostResponse; tr: TeamDraftI18n; onDelete: (pk: string) => void }) {
  const navigate = useNavigate();

  const title = draft.title.trim() === "" ? tr.untitled : draft.title;
  const preview = toPlainText(draft.body);
  const updated = formatRelative(draft.updated_at, tr);

  const firstChar = [...draft.author_display_name][0];
  const authorInitial = firstChar === undefined ? "?" : firstChar.toUpperCase();
  const authorName = draft.author_display_name === "" ? draft.author_username : draft.author_display_name;

  return (
    <div
      className="td-card"
      onClick={(e) => {
        if (isVirtuallyStopped(e)) return;
        navigate(`/posts/${partitionId(draft.pk)}/edit`);
      }}
    >
      <div className="td-card__head">
        <div className="td-card__meta-left">
          <span className="td-badge">{tr.badgeDraft}</span>
          <span className="td-updated">{updated}</span>
        </div>
        <button
          className="td-action"
          type="button"
          aria-label={DELETE_DRAFT_LABEL}
          onClick={(e) => {
            stopVirtual(e);
            onDelete(draft.pk);
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
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
      <h3 className="td-card__title">{title}</h3>
      {preview !== "" && <p className="td-card__preview">{preview}</p>}
      <div className="td-card__foot">
        <div className="td-author">
          {draft.author_profile_url !== "" ? (
            <img className="td-author__avatar" src={draft.author_profile_url} alt={authorName} />
          ) : (
            <div className="td-author__avatar">{authorInitial}</div>
          )}
          <span className="td-author__name">{authorName}</span>
        </div>
        <span className="td-edit-hint">
          {tr.edit}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/** `format_relative` (mod.rs:363-378). */
function formatRelative(updatedMs: number, tr: TeamDraftI18n): string {
  if (updatedMs === 0) return NO_TIMESTAMP;
  const diffSecs = Math.trunc(Math.max(Date.now() - updatedMs, 0) / 1000);
  if (diffSecs < 60) return tr.updatedJustNow;
  if (diffSecs < 3600) return `${Math.trunc(diffSecs / 60)} ${tr.updatedMinutes}`;
  if (diffSecs < 86_400) return `${Math.trunc(diffSecs / 3600)} ${tr.updatedHours}`;
  return `${Math.trunc(diffSecs / 86_400)} ${tr.updatedDays}`;
}
