import { useEffect, useRef, useState } from "react";
import type { File as RatelFile } from "@ratel/ts-bridges";
import { createFileLink, removeDiscussionFile } from "@ratel/ts-bridges";
import { useUpdateDiscussion } from "@ratel/ts-bridges/hooks";
import { ActionDescriptionEditor } from "@/components/space-actions/action-description-editor";
import { AutosaveStatusBadge, type SaveStatus } from "@/components/space-actions/autosave-status-badge";
import { FileUploader } from "@/components/ui/file-uploader";
import { useSpace } from "@/components/space/space-context";
import { FileExtension, FileExtensionIcon } from "@/components/ui/file-extension-icon";
import { useDiscussionEditorI18n } from "@/pages/spaces/[spaceId]/actions/discussions/[discussionId]/edit/i18n";
import { extractFilenameFromUrl, fileExtensionFromNameOrUrl } from "@/lib/file-ext";
import { useToast } from "@/lib/toast";
import { useDiscussion } from "../hooks/use-discussion";

// discussion/views/editor/content_card/component.rs (`ContentCard`) — title,
// rich body, and attachments. `importRequest` (bumped by the topbar "Import
// from overview" button) overwrites title/body from the space overview.

function iconClass(ext: RatelFile["ext"]): string {
  if (ext === FileExtension.PDF) return "file-row__icon file-row__icon--pdf";
  if (ext === FileExtension.JPG || ext === FileExtension.PNG) return "file-row__icon file-row__icon--img";
  if (ext === FileExtension.WORD || ext === FileExtension.EXCEL || ext === FileExtension.PPTX) return "file-row__icon file-row__icon--doc";
  return "file-row__icon";
}

export function DiscussionContentCard() {
  const tr = useDiscussionEditorI18n();
  const toast = useToast();
  const { spaceId, discussionId, discussion, refresh, importRequest } = useDiscussion();
  const update = useUpdateDiscussion();
  const space = useSpace();

  const initialPost = discussion.post;
  const [htmlContents, setHtmlContents] = useState(initialPost.html_contents);
  const lastSavedHtml = useRef(initialPost.html_contents);
  const [htmlStatus, setHtmlStatus] = useState<SaveStatus>("Idle");

  const [title, setTitle] = useState(initialPost.title);
  const lastSavedTitle = useRef(initialPost.title);
  const [titleStatus, setTitleStatus] = useState<SaveStatus>("Idle");

  const [files, setFiles] = useState<RatelFile[]>(initialPost.files);

  // Bumped when overview is imported, to force the rich editor to remount
  // (it snapshots its content once at mount).
  const [editorEpoch, setEditorEpoch] = useState(0);

  const saveHtml = (current: string) => {
    if (current === lastSavedHtml.current) return;
    setHtmlStatus("Saving");
    update
      .mutateAsync({ spaceId, discussionSk: discussionId, req: { title: null, html_contents: current, category_name: null, files: null } })
      .then(() => {
        lastSavedHtml.current = current;
        setHtmlStatus("Saved");
        refresh();
      })
      .catch((err) => {
        setHtmlStatus("Unsaved");
        toast.error(err);
      });
  };

  const saveTitle = (current: string) => {
    if (current === lastSavedTitle.current) return;
    setTitleStatus("Saving");
    update
      .mutateAsync({ spaceId, discussionSk: discussionId, req: { title: current, html_contents: null, category_name: null, files: null } })
      .then(() => {
        lastSavedTitle.current = current;
        setTitleStatus("Saved");
        refresh();
      })
      .catch((err) => {
        setTitleStatus("Unsaved");
        toast.error(err);
      });
  };

  const titleTimer = useRef<number | null>(null);
  const htmlTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (titleTimer.current !== null) window.clearTimeout(titleTimer.current);
      if (htmlTimer.current !== null) window.clearTimeout(htmlTimer.current);
    },
    [],
  );

  // Import from overview — always overwrites title/body in a single PATCH.
  const lastImportRequest = useRef(0);
  useEffect(() => {
    if (importRequest === 0 || importRequest === lastImportRequest.current) return;
    lastImportRequest.current = importRequest;
    const overviewTitle = space.title;
    const overviewContent = space.content;
    setTitle(overviewTitle);
    setHtmlContents(overviewContent);
    setEditorEpoch((e) => e + 1);
    setTitleStatus("Saving");
    setHtmlStatus("Saving");
    update
      .mutateAsync({ spaceId, discussionSk: discussionId, req: { title: overviewTitle, html_contents: overviewContent, category_name: null, files: null } })
      .then(() => {
        lastSavedTitle.current = overviewTitle;
        lastSavedHtml.current = overviewContent;
        setTitleStatus("Saved");
        setHtmlStatus("Saved");
        refresh();
      })
      .catch((err) => {
        setTitleStatus("Unsaved");
        setHtmlStatus("Unsaved");
        toast.error(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importRequest]);

  const saveFilesAfterUpload = (next: RatelFile[]) => {
    update
      .mutateAsync({ spaceId, discussionSk: discussionId, req: { title: null, html_contents: null, category_name: null, files: next } })
      .catch((err) => toast.error(err));
  };

  return (
    <section className="pager__page" data-page="0">
      <article className="page-card" data-testid="page-card-content">
        <header className="page-card__head">
          <div className="page-card__title-wrap">
            <span className="page-card__num">{tr.cardIndex1}</span>
            <div>
              <h1 className="page-card__title">{tr.cardContentTitle}</h1>
              <div className="page-card__subtitle">{tr.cardContentSubtitle}</div>
            </div>
          </div>
        </header>

        <section className="section" data-testid="section-content">
          <div className="section__head">
            <span className="section__label">{tr.sectionContentLabel}</span>
            <span className="section__hint section__hint--markdown">{tr.sectionContentHint}</span>
          </div>
          <div className="field">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <label className="field__label">{tr.titleLabel}</label>
              <AutosaveStatusBadge
                status={titleStatus}
                labels={{ autosaveSaving: tr.autosaveSaving, autosaveSaved: tr.autosaveSaved, autosaveUnsaved: tr.autosaveUnsaved }}
              />
            </div>
            <input
              className="input"
              data-testid="discussion-title"
              placeholder={tr.titlePlaceholder}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleStatus("Unsaved");
                if (titleTimer.current !== null) window.clearTimeout(titleTimer.current);
                titleTimer.current = window.setTimeout(() => saveTitle(e.target.value), 3000);
              }}
              onBlur={() => saveTitle(title)}
            />
          </div>
          <div className="editor">
            <ActionDescriptionEditor
              key={editorEpoch}
              className="[&_.re-toolbar]:border-b [&_.re-toolbar]:border-[rgba(255,255,255,0.06)] [&_.re-content]:min-h-[220px] [&_.re-content]:px-[22px] [&_.re-content]:py-[20px] [&_.re-content]:outline-none"
              content={htmlContents}
              editable
              placeholder=""
              onContentChange={(html) => {
                setHtmlContents(html);
                if (html !== lastSavedHtml.current) {
                  setHtmlStatus("Unsaved");
                  if (htmlTimer.current !== null) window.clearTimeout(htmlTimer.current);
                  htmlTimer.current = window.setTimeout(() => saveHtml(html), 3000);
                }
              }}
            />
            <div className="editor__footer">
              <AutosaveStatusBadge
                status={htmlStatus}
                labels={{ autosaveSaving: tr.autosaveSaving, autosaveSaved: tr.autosaveSaved, autosaveUnsaved: tr.autosaveUnsaved }}
              />
            </div>
          </div>
        </section>

        <section className="section" data-testid="section-attachments">
          <div className="section__head">
            <span className="section__label">{tr.sectionAttachmentsLabel}</span>
            <span className="section__hint">{tr.sectionAttachmentsHint}</span>
          </div>

          <div data-testid="attachment-list">
            {files.map((file, idx) => (
              <div key={`file-${idx}`} className="file-row">
                <div className={iconClass(file.ext)}>
                  <FileExtensionIcon ext={file.ext} size={14} />
                </div>
                <div className="file-row__info">
                  <div className="file-row__name">{file.name}</div>
                  <div className="file-row__meta">{`${file.ext.toUpperCase()} · ${file.size}`}</div>
                </div>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label={tr.removeFile}
                  onClick={() => {
                    const prev = files;
                    setFiles((fs) => fs.filter((f) => f.id !== file.id));
                    removeDiscussionFile(spaceId, discussionId, { file_url: file.id })
                      .then(refresh)
                      .catch((err) => {
                        setFiles(prev);
                        toast.error(err);
                      });
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <FileUploader
            accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.mp4,.mov"
            onUploadSuccess={() => undefined}
            onUploadMeta={({ url, name, size }) => {
              const uploadedName = name.trim() === "" ? extractFilenameFromUrl(url) : name;
              const ext = fileExtensionFromNameOrUrl(uploadedName, url);
              createFileLink(spaceId, { file_url: url, file_name: uploadedName, link_target: `BOARD#${discussionId}` })
                .then(() => {
                  const next: RatelFile = {
                    id: url,
                    name: uploadedName,
                    size,
                    ext,
                    url,
                    uploader_name: null,
                    uploader_profile_url: null,
                    uploaded_at: Date.now(),
                  };
                  setFiles((fs) => {
                    const updated = [...fs, next];
                    saveFilesAfterUpload(updated);
                    return updated;
                  });
                })
                .catch((err) => toast.error(err));
            }}
          >
            <div className="dropzone" data-testid="attachment-dropzone" tabIndex={0}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div className="dropzone__text">
                <span className="dropzone__title">{tr.dropzoneTitle}</span>
                <span className="dropzone__sub">{tr.dropzoneSub}</span>
              </div>
            </div>
          </FileUploader>
        </section>
      </article>
    </section>
  );
}
