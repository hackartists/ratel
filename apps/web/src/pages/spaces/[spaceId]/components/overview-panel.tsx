import * as React from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCreateFileLink, useDeleteFileLink, useUpdateSpaceContent } from "@ratel/ts-bridges/hooks";
import { getOverviewFiles } from "@ratel/ts-bridges";
import type { File, FileLinkTarget } from "@ratel/ts-bridges";
import { FileUploadZone } from "@/components/space/file-upload-zone";
import { useSpaceContext } from "@/components/space/space-context";
import { useSpaceViewerI18n } from "./space-viewer.i18n";
import { dataBool } from "@/lib/dom";
import { useToast } from "@/lib/toast";
import { DEFAULT_PROFILE, formatNumber } from "./format";

// app/ratel/src/features/spaces/pages/index/overview_panel/component.rs (`OverviewPanel`).
// The Rust component suspends on `get_overview_files` (`use_loader(..)?`), so the
// page renders it the same way: the suspending query lives here.

/** `FileLinkTarget::Overview` wire string (DynamoEnum Display, SCREAMING_SNAKE like `PRIVATE`). */
const LINK_TARGET_OVERVIEW: FileLinkTarget = "OVERVIEW";

export function OverviewPanel({
  open,
  onClose,
  remaining,
  rewards,
  isAdmin = false,
}: {
  open: boolean;
  onClose: () => void;
  remaining: string;
  rewards: string;
  isAdmin?: boolean;
}) {
  const tr = useSpaceViewerI18n();
  const ctx = useSpaceContext();
  const toast = useToast();
  const queryClient = useQueryClient();
  const updateContent = useUpdateSpaceContent();
  const createFileLink = useCreateFileLink();
  const deleteFileLink = useDeleteFileLink();
  const space = ctx.space;
  const spaceId = ctx.spaceId;
  const participants = formatNumber(space.participants);
  const authorProfile = space.author_profile_url === "" ? DEFAULT_PROFILE : space.author_profile_url;

  const [editing, setEditing] = React.useState(false);
  const [aboutValue, setAboutValue] = React.useState(space.content);
  const [aboutDisplay, setAboutDisplay] = React.useState(space.content);
  const [isSaving, setIsSaving] = React.useState(false);

  const filesKey = ["getOverviewFiles", spaceId] as const;
  const { data: loadedFiles } = useSuspenseQuery({ queryKey: filesKey, queryFn: () => getOverviewFiles(spaceId) });
  const [files, setFiles] = React.useState<File[]>([]);
  const [originalFiles, setOriginalFiles] = React.useState<File[]>([]);

  // Rust effect: outside edit mode, mirror the loader.
  React.useEffect(() => {
    if (!editing) setFiles(loadedFiles);
  }, [editing, loadedFiles]);

  const onSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const html = aboutValue;
    const currentFiles = files;
    const origFiles = originalFiles;
    try {
      await updateContent.mutateAsync({ spacePk: spaceId, req: { content: html } });
    } catch (err) {
      toast.error(err);
      setIsSaving(false);
      return;
    }
    const origUrls = new Set(origFiles.flatMap((f) => (f.url !== null ? [f.url] : [])));
    const currentUrls = new Set(currentFiles.flatMap((f) => (f.url !== null ? [f.url] : [])));
    for (const file of currentFiles) {
      if (file.url !== null && !origUrls.has(file.url)) {
        await createFileLink
          .mutateAsync({
            spacePk: spaceId,
            req: { file_url: file.url, file_name: file.name, link_target: LINK_TARGET_OVERVIEW },
          })
          .catch(() => undefined);
      }
    }
    for (const file of origFiles) {
      if (file.url !== null && !currentUrls.has(file.url)) {
        await deleteFileLink
          .mutateAsync({ spacePk: spaceId, req: { file_url: file.url, link_target: LINK_TARGET_OVERVIEW } })
          .catch(() => undefined);
      }
    }
    setAboutDisplay(html);
    setEditing(false);
    void queryClient.refetchQueries({ queryKey: filesKey, exact: true });
    void ctx.restartSpace();
    setIsSaving(false);
  };

  return (
    <div className="overview-panel" data-testid="overview-panel" data-open={dataBool(open)} data-editing={dataBool(editing)}>
      <div className="overview-panel__header">
        <div className="overview-panel__title-wrap">
          <span className="overview-panel__title">{tr.overview}</span>
          {editing && (
            <span className="overview-panel__mode-badge">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              {tr.editing}
            </span>
          )}
        </div>
        <div className="overview-panel__actions">
          {isAdmin && !editing && (
            <button
              aria-label={tr.edit}
              className="overview-icon-btn overview-edit-btn"
              data-testid="overview-edit-btn"
              onClick={() => {
                setAboutValue(aboutDisplay);
                setOriginalFiles(files);
                setEditing(true);
              }}
            >
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          )}
          {isAdmin && editing && (
            <>
              <button
                aria-label={tr.cancel}
                className="overview-icon-btn overview-icon-btn--danger"
                data-testid="overview-cancel-btn"
                disabled={isSaving}
                onClick={() => {
                  setFiles(originalFiles);
                  setEditing(false);
                }}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </button>
              <button className="overview-save" data-testid="overview-save-btn" disabled={isSaving} onClick={() => void onSave()}>
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {tr.save}
              </button>
            </>
          )}
          <button aria-label="Close overview" className="overview-icon-btn overview-panel__close" onClick={() => onClose()}>
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div className="overview-panel__body">
        <div className="overview-section">
          <div className="overview-section__label">
            {tr.about}
            <span className="overview-section__label-hint">{tr.aboutEditHint}</span>
          </div>
          {!editing ? (
            <div
              className="overview-section__content ProseMirror"
              data-editable="about"
              dangerouslySetInnerHTML={{ __html: aboutDisplay }}
            />
          ) : (
            <textarea
              className="overview-section__input"
              data-testid="overview-about-input"
              placeholder={tr.questDescPlaceholder}
              rows={5}
              value={aboutValue}
              onChange={(e) => setAboutValue(e.currentTarget.value)}
            />
          )}
        </div>
        <div className="overview-section">
          <span className="overview-section__label">{tr.keyMetrics}</span>
          <div className="overview-info-grid">
            <div className="overview-info-card">
              <span className="overview-info-card__value">{participants}</span>
              <span className="overview-info-card__label">{tr.participants}</span>
            </div>
            <div className="overview-info-card">
              <span className="overview-info-card__value">{remaining}</span>
              <span className="overview-info-card__label">{tr.spotsLeft}</span>
            </div>
            <div className="overview-info-card">
              <span className="overview-info-card__value">{rewards}</span>
              <span className="overview-info-card__label">{tr.rewardPool}</span>
            </div>
            <div className="overview-info-card">
              <span className="overview-info-card__value">{space.likes}</span>
              <span className="overview-info-card__label">{tr.likes}</span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="overview-section overview-section--files">
            <div className="overview-section__label">
              {tr.files}
              <span className="overview-section__label-hint">{tr.filesHint}</span>
            </div>
            <div className="file-list">
              {files.map((file) => {
                const kindCls =
                  file.ext === "PDF"
                    ? "file-item__icon--pdf"
                    : file.ext === "JPG" || file.ext === "PNG"
                      ? "file-item__icon--img"
                      : "file-item__icon--doc";
                const key = file.url ?? file.name;
                // Read-only rows open the file (a new tab, like FileCard
                // elsewhere); while editing the row stays a plain box so the
                // remove button can't navigate away.
                const RowTag = !editing && file.url !== null ? "a" : "div";
                const rowProps =
                  RowTag === "a"
                    ? {
                        href: file.url ?? undefined,
                        target: "_blank",
                        rel: "noreferrer noopener",
                        download: file.name,
                      }
                    : {};
                return (
                  <RowTag className="file-item" key={key} {...rowProps}>
                    <div className={`file-item__icon ${kindCls}`}>
                      <svg
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="file-item__info">
                      <div className="file-item__name">{file.name}</div>
                      <div className="file-item__meta">{file.size}</div>
                    </div>
                    {editing && (
                      <div className="file-item__actions">
                        <button
                          aria-label="Remove file"
                          className="file-item__remove"
                          onClick={() => setFiles((v) => v.filter((f) => f.url !== file.url))}
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </RowTag>
                );
              })}
            </div>
            {editing && <FileUploadZone onUpload={(file) => setFiles((v) => [...v, file])} />}
          </div>
        )}
        <div className="overview-section">
          <span className="overview-section__label">{tr.createdBy}</span>
          <div className="overview-author-row">
            <img alt="Author" className="overview-author-avatar" src={authorProfile} />
            <div>
              <div className="overview-author-name">{space.author_display_name}</div>
              <div className="overview-author-username">@{space.author_username}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
