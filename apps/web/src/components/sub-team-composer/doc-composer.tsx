import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Editor } from "@/components/editor";
import { FileUploader, type UploadedFileMeta } from "@/components/ui/file-uploader";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n } from "@/pages/[username]/sub-teams/sub-team.i18n";
import { dataBool } from "@/lib/dom";
import type { File as SubTeamFile } from "@ratel/ts-bridges";
import { AttachmentRow } from "./attachment-row";
import { useDocComposer } from "./hooks/use-doc-composer";
import { fileExtensionFromNameOrUrl, parseSizeToBytes, prettySize, timeAgo } from "./utils";

// app/ratel/src/features/sub_team/pages/doc_compose/component.rs
// (`TeamSubTeamDocEditPage` / `TeamSubTeamBylawsComposePage`, via the shared
// `render_compose` + `DocComposeForm`). `docId` set ⇒ edit an existing doc;
// `category` set (docId unset) ⇒ create a new bylaws-mode doc.

export interface DocComposerProps {
  username: string;
  docId?: string;
  category?: string;
}

export function DocComposer({ username, docId, category }: DocComposerProps) {
  const tr = useSubTeamI18n();
  const navigate = useNavigate();
  const { doc, saveNew, saveExisting } = useDocComposer(username, docId);

  const [title, setTitle] = useState(doc?.title ?? "");
  const [body, setBody] = useState(doc?.body ?? "");
  const [required, setRequired] = useState(doc?.required ?? false);
  const [attachments, setAttachments] = useState<SubTeamFile[]>(doc?.attachments ?? []);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fixed for the composer's lifetime — mirrors the Rust `current_id`
  // signal, which the doc composer never mutates after mount (unlike the
  // broadcast composer's autosave, saving here always navigates away).
  const currentId = docId ?? null;
  const initialUpdatedAt = doc?.updated_at ?? 0;
  const initialVersion = doc ? Math.max(doc.version, 1) : 0;
  const initialEditor = doc?.editor_username ?? "";
  const categoryValue = category && category.trim() !== "" ? category : null;

  const goBackToManagement = () => navigate(`/${username}/sub-teams/manage`);

  const save = () => {
    void (async () => {
      try {
        if (currentId) {
          await saveExisting(currentId, {
            title,
            body,
            required,
            order: null,
            attachments,
          });
        } else {
          await saveNew({
            title,
            body,
            required,
            order: null,
            attachments,
            category: categoryValue,
          });
        }
      } catch (e) {
        console.error(`sub-team doc save failed: ${String(e)}`);
        return;
      }
      goBackToManagement();
    })();
  };

  const discard = () => goBackToManagement();

  const charCount = Array.from(body).length;
  const wordCount = body.split(/\s+/).filter((w) => w.length > 0).length;

  const updatedAtDisplay = initialUpdatedAt > 0 ? timeAgo(initialUpdatedAt) : "—";
  const versionLabel = currentId !== null ? `v${Math.max(initialVersion, 1)}` : "draft v1";
  const editorLabel = initialEditor === "" ? "—" : initialEditor;

  const attachmentCount = attachments.length;
  const attachmentsSizeLabel =
    attachmentCount === 0
      ? tr.docComposeAttachNone
      : `${attachmentCount} ${tr.docComposeAttachFilesUnit} · ${prettySize(attachments.reduce((sum, f) => sum + parseSizeToBytes(f.size), 0))}`;

  const topbarMain = title !== "" ? title : currentId !== null ? tr.docComposeTitleEdit : tr.docComposeTitleNew;

  return (
    <>
      <SeoMeta title={currentId !== null ? tr.docComposeTitleEdit : tr.docComposeTitleNew} />

      <div className="sub-team-doc-compose">
        {/* ── 1. TOP BAR ───────────────────────────────────── */}
        <div className="arena-topbar">
          <div className="arena-topbar__left">
            <a className="back-btn" aria-label="Back" onClick={goBackToManagement}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </a>
            <div className="topbar-title">
              <span className="topbar-title__eyebrow">{tr.docComposeEyebrow}</span>
              <span className="topbar-title__main">{topbarMain}</span>
            </div>
          </div>
          <div className="arena-topbar__right">
            <span className="autosave">{currentId !== null ? tr.docComposeAutosaved : tr.docComposeDraftUnsaved}</span>
            <button className="topbar-btn" data-testid="sub-team-doc-preview-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {tr.docComposePreview}
            </button>
            <button className="topbar-btn topbar-btn--primary" id="publish-btn" data-testid="sub-team-doc-save-btn" onClick={save}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {tr.save}
            </button>
          </div>
        </div>

        {/* ── 2. EDIT BANNER ───────────────────────────────── */}
        <div className="edit-banner">
          <div className="edit-banner__inner">
            <div className="edit-banner__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="edit-banner__body">
              <div className="edit-banner__label">{tr.docComposeBannerLabel}</div>
              <div className="edit-banner__text">{tr.docComposeBannerText}</div>
            </div>
          </div>
        </div>

        {/* ── 3. COMPOSER PAGE (grid: composer + side-panel) ─ */}
        <div className="composer-page">
          <main className="composer">
            <div>
              <input
                className="title-input"
                type="text"
                data-testid="sub-team-doc-title-input"
                placeholder={tr.docComposeTitlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="title-divider" />
            </div>

            <Editor
              className="w-full"
              content={body}
              editable
              placeholder={tr.docComposeBodyPlaceholder}
              onContentChange={(html) => setBody(html)}
            />
          </main>

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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {tr.docComposeRequiredCardTitle}
              </div>
              <label className="required-row" data-on={dataBool(required)}>
                <div className="required-row__body">
                  <div className="required-row__title">{required ? tr.docComposeRequiredOn : tr.docComposeRequiredOff}</div>
                  <div className="required-row__desc">{tr.docComposeRequiredDesc}</div>
                </div>
                <span className="switch" aria-checked={dataBool(required)}>
                  <input
                    type="checkbox"
                    data-testid="sub-team-doc-required-toggle"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                  />
                </span>
              </label>
            </div>

            <div className="side-card">
              <div className="side-card__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {tr.docComposeInfoTitle}
              </div>
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-row__k">{tr.docComposeInfoVersion}</span>
                  <span className="meta-row__v meta-row__v--accent">{versionLabel}</span>
                </div>
                {currentId !== null && (
                  <>
                    <div className="meta-row">
                      <span className="meta-row__k">{tr.docComposeInfoUpdated}</span>
                      <span className="meta-row__v">{updatedAtDisplay}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-row__k">{tr.docComposeInfoEditor}</span>
                      <span className="meta-row__v">{editorLabel}</span>
                    </div>
                  </>
                )}
                <div className="meta-row">
                  <span className="meta-row__k">{tr.docComposeInfoAttachments}</span>
                  <span className="meta-row__v">{attachmentsSizeLabel}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-row__k">{tr.docComposeInfoRequired}</span>
                  <span className="meta-row__v meta-row__v--accent">{required ? tr.yes : tr.no}</span>
                </div>
              </div>
            </div>

            <div className="side-card">
              <div className="attachments">
                <div className="attachments__title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  {tr.docComposeAttachmentsTitle}
                  <span className="attachments__count">{attachmentCount}</span>
                </div>

                <div className="attachment-list" id="attach-list">
                  {attachments.map((f, idx) => (
                    <AttachmentRow
                      key={`${f.id}-${idx}`}
                      file={f}
                      onRemove={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    />
                  ))}
                </div>

                <FileUploader
                  className="file-dropzone"
                  accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg"
                  onUploadSuccess={() => {}}
                  onUploadMeta={(uploaded: UploadedFileMeta) => {
                    const uploadedName = uploaded.name.trim() === "" ? (uploaded.url.split("/").pop() ?? "file") : uploaded.name;
                    const ext = fileExtensionFromNameOrUrl(uploadedName, uploaded.url);
                    setAttachments((prev) => [
                      ...prev,
                      {
                        id: uploaded.url,
                        name: uploadedName,
                        size: uploaded.size,
                        ext,
                        url: uploaded.url,
                        uploader_name: null,
                        uploader_profile_url: null,
                        uploaded_at: Date.now(),
                      },
                    ]);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span data-testid="sub-team-doc-attach-btn">
                    {tr.docComposeUploadTitle}
                    <small>{tr.docComposeUploadHint}</small>
                  </span>
                </FileUploader>
              </div>
            </div>

            <button className="danger-row" type="button" onClick={discard}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
              {tr.docComposeDiscard}
            </button>
          </aside>
        </div>

        {/* ── 4. DRAWER BACKDROP (mobile only) ─────────────── */}
        <div className="drawer-backdrop" data-open={dataBool(drawerOpen)} onClick={() => setDrawerOpen(false)} />

        {/* ── 5. BOTTOM BAR ─────────────────────────────────── */}
        <div className="bottom-bar">
          <div className="bottom-bar__left">
            <span className="bottom-bar__stat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <strong>{wordCount}</strong>
              {` ${tr.docComposeStatsWords} · `}
              <strong>{charCount}</strong>
              {` ${tr.docComposeStatsChars}`}
            </span>
          </div>
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
            <button
              className="bottom-bar__btn bottom-bar__btn--mobile bottom-bar__btn--primary"
              data-testid="sub-team-doc-save-btn-mobile"
              onClick={save}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{tr.save}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
