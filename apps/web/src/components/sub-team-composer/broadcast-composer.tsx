import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Editor } from "@/components/editor";
import { FileUploader, type UploadedFileMeta } from "@/components/ui/file-uploader";
import { ChevronLeft, Lock, Send, Trash2, Users } from "@/components/icons/lucide";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { dataBool } from "@/lib/dom";
import type { File as SubTeamFile } from "@ratel/ts-bridges";
import { useBroadcastComposer, type BroadcastDraftStatus } from "./hooks/use-broadcast-composer";
import { fileExtensionFromNameOrUrl } from "./utils";

// app/ratel/src/features/sub_team/pages/broadcast_compose/component.rs
// (`TeamSubTeamBroadcastComposePage` / `TeamSubTeamBroadcastEditPage` /
// `TeamSubTeamDirectComposePage`, via the shared `render_compose` +
// `ComposeForm`).

export interface BroadcastComposerProps {
  username: string;
  announcementId?: string;
  /** Set only for the direct-to-one-sub-team composer. */
  targetChildTeamId?: string;
}

function statusText(tr: ReturnType<typeof useSubTeamI18n>, status: BroadcastDraftStatus): string {
  switch (status) {
    case "idle":
      return tr.broadcastStatusIdle;
    case "dirty":
      return tr.broadcastStatusDirty;
    case "saving":
      return tr.broadcastStatusSaving;
    case "saved":
      return tr.broadcastStatusSaved;
    case "error":
      return tr.broadcastStatusError;
  }
}

export function BroadcastComposer({ username, announcementId, targetChildTeamId }: BroadcastComposerProps) {
  const tr = useSubTeamI18n();
  const navigate = useNavigate();
  const {
    teamDisplay,
    teamHandle,
    isDirect,
    announcementId: currentAnnouncementId,
    title,
    setTitle,
    htmlContents,
    setHtmlContents,
    tags,
    setTags,
    attachments,
    setAttachments,
    spaceEnabled,
    setSpaceEnabled,
    draftStatus,
    publish,
    discard,
  } = useBroadcastComposer(username, announcementId, targetChildTeamId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagIsComposing, setTagIsComposing] = useState(false);

  const publishDisabled = currentAnnouncementId === null || title === "";

  const commitTag = () => {
    const v = tagDraft.trim();
    if (v !== "" && !tags.includes(v)) {
      setTags([...tags, v]);
    }
    setTagDraft("");
  };

  const removeAttachment = (idx: number) => setAttachments(attachments.filter((_, i) => i !== idx));

  return (
    <div className="sub-team-broadcast-compose">
      {/* Rust hardcodes this to `broadcast_compose` even on the direct-compose route. */}
      <SeoMeta title={tr.broadcastCompose} />

      {/* ── Topbar ───────────────────────────────────────────── */}
      <div className="arena-topbar">
        <div className="arena-topbar__left">
          <div className="back-btn" role="button" aria-label="Back" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4 [&>path]:stroke-current" />
          </div>
          <div className="topbar-title">
            <span className="topbar-title__eyebrow">{isDirect ? tr.directCompose : tr.broadcastCompose}</span>
            <span className="topbar-title__main">{isDirect ? tr.directCompose : tr.broadcastCompose}</span>
          </div>
        </div>
        <div className="arena-topbar__right">
          <span
            className="autosave-chip"
            data-state={draftStatus === "saved" ? "saved" : draftStatus === "saving" ? "saving" : draftStatus === "error" ? "error" : "idle"}
          >
            <span className="autosave-chip__dot" />
            {statusText(tr, draftStatus)}
          </span>
          <div
            className="topbar-btn topbar-btn--primary"
            id="publish-btn"
            data-testid="sub-team-broadcast-publish-btn"
            role="button"
            onClick={() => void publish()}
            aria-disabled={dataBool(publishDisabled)}
          >
            <Send className="w-3 h-3 [&>path]:stroke-current" />
            {tr.broadcastPublish}
          </div>
        </div>
      </div>

      <div className="composer-page">
        {/* ── Main column ──────────────────────────────────────── */}
        <main className="composer">
          <div>
            <input
              className="title-input"
              type="text"
              data-testid="sub-team-broadcast-title-input"
              placeholder={tr.broadcastTitlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="title-divider" />
          </div>

          <Editor
            key={currentAnnouncementId ?? ""}
            className="sub-team-broadcast-body"
            content={htmlContents}
            placeholder={tr.broadcastBodyPlaceholder}
            onContentChange={(v) => setHtmlContents(v)}
          />
        </main>

        {/* ── Right panel ──────────────────────────────────────── */}
        <aside className="side-panel" data-open={dataBool(drawerOpen)}>
          <div className="side-panel__head">
            <span className="side-panel__handle" />
            <span className="side-panel__title">{tr.subTeamOptionsDrawerTitle}</span>
            <button className="side-panel__close" aria-label={tr.subTeamOptionsClose} onClick={() => setDrawerOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="side-card">
            <div className="side-card__title">
              <Users className="w-3 h-3 [&>path]:stroke-current" />
              {tr.broadcastPostingAs}
            </div>
            <div className="locked-row">
              <div className="locked-row__avatar">{teamDisplay.slice(0, 3).toUpperCase()}</div>
              <div className="locked-row__body">
                <div className="locked-row__name">{teamDisplay}</div>
                <div className="locked-row__meta">{`@${teamHandle}`}</div>
              </div>
              <span className="locked-row__lock" aria-label="Locked">
                <Lock className="w-3 h-3 [&>path]:stroke-current" />
              </span>
            </div>
          </div>

          <div className="side-card space-toggle" data-on={dataBool(spaceEnabled)}>
            <div className="space-toggle__head">
              <div className="side-card__title" style={{ margin: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                {tr.broadcastEnableSpace}
              </div>
              <button
                className="switch"
                type="button"
                role="switch"
                aria-checked={dataBool(spaceEnabled)}
                aria-label={tr.broadcastEnableSpace}
                data-testid="sub-team-broadcast-space-toggle"
                onClick={() => setSpaceEnabled(!spaceEnabled)}
              >
                <span className="switch__track">
                  <span className="switch__thumb" />
                </span>
              </button>
            </div>
            <div className="space-toggle__hint">{tr.broadcastSpaceHint}</div>
            <div className="space-toggle__active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {tr.broadcastSpaceActiveHint}
            </div>
          </div>

          <div className="side-card">
            <div className="side-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              </svg>
              {tr.broadcastSectionTags}
            </div>
            <div className="tag-input" data-testid="sub-team-broadcast-tag-input">
              {tags.map((tag) => (
                <span className="tag" key={tag} data-testid="sub-team-broadcast-tag" data-tag-value={tag}>
                  {tag}
                  <button
                    className="tag__x"
                    data-testid="sub-team-broadcast-tag-remove"
                    data-tag-value={tag}
                    aria-label={tr.broadcastRemoveTag}
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                className="tag-input__field"
                data-testid="sub-team-broadcast-tag-input-field"
                type="text"
                placeholder={tr.broadcastTagPlaceholder}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onCompositionStart={() => setTagIsComposing(true)}
                onCompositionEnd={() => setTagIsComposing(false)}
                onKeyDown={(e) => {
                  // Korean IME: skip Enter while composing the trailing
                  // character — otherwise it leaks into a duplicate tag.
                  if (tagIsComposing) return;
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTag();
                  }
                }}
              />
            </div>
          </div>

          <div className="side-card">
            <div className="side-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {tr.broadcastSectionAttachments}
            </div>

            {attachments.length === 0 ? (
              <div className="space-toggle__hint">{tr.broadcastAttachmentsNone}</div>
            ) : (
              <div className="attachment-list">
                {attachments.map((f, idx) => (
                  <div className="file-row" key={`${f.id}-${idx}`}>
                    <div className="file-row__icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="file-row__body">
                      <div className="file-row__name">{f.name}</div>
                      <div className="file-row__meta">{f.size}</div>
                    </div>
                    <button
                      className="file-row__remove"
                      type="button"
                      aria-label={tr.broadcastRemoveTag}
                      onClick={() => removeAttachment(idx)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <FileUploader
              className="file-dropzone"
              accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg"
              onUploadSuccess={() => {}}
              onUploadMeta={(uploaded: UploadedFileMeta) => {
                const uploadedName = uploaded.name.trim() === "" ? (uploaded.url.split("/").pop() ?? "file") : uploaded.name;
                const ext = fileExtensionFromNameOrUrl(uploadedName, uploaded.url);
                const file: SubTeamFile = {
                  id: uploaded.url,
                  name: uploadedName,
                  size: uploaded.size,
                  ext,
                  url: uploaded.url,
                  uploader_name: null,
                  uploader_profile_url: null,
                  uploaded_at: Date.now(),
                };
                setAttachments([...attachments, file]);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="file-dropzone__label">
                {tr.broadcastAttachmentsUploadTitle}
                <small>{tr.broadcastAttachmentsUploadHint}</small>
              </span>
            </FileUploader>
          </div>

          {currentAnnouncementId !== null && (
            <div
              className="danger-row"
              data-testid="sub-team-broadcast-discard-btn"
              role="button"
              onClick={() => void discard()}
            >
              <Trash2 className="w-3 h-3 [&>path]:stroke-current" />
              {tr.broadcastDiscardDraft}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile drawer backdrop — dims the page when the side-panel is slid up. */}
      <div className="drawer-backdrop" data-open={dataBool(drawerOpen)} onClick={() => setDrawerOpen(false)} />

      {/* Bottom bar (mobile-only). */}
      <div className="bottom-bar">
        <div className="bottom-bar__right">
          <button className="bottom-bar__btn bottom-bar__btn--mobile" onClick={() => setDrawerOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            {tr.subTeamOptions}
          </button>
          <div
            className="bottom-bar__btn bottom-bar__btn--mobile bottom-bar__btn--primary"
            data-testid="sub-team-broadcast-publish-btn-mobile"
            role="button"
            onClick={() => void publish()}
            aria-disabled={dataBool(publishDisabled)}
          >
            <Send className="w-3 h-3 [&>path]:stroke-current" />
            {tr.broadcastPublish}
          </div>
        </div>
      </div>
    </div>
  );
}
