import { useGetSpaceFiles, useListFileLinks } from "@ratel/ts-bridges/hooks";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSpaceFileI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/file/space-file.i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { dataBool } from "@/lib/dom";
import { FileRow } from "./components/file-row";
import {
  DEFAULT_SPACE_LOGO,
  effectiveExt,
  extLabel,
  filterByTarget,
  isAudioExt,
  isBoardTarget,
  isImageExt,
  isOverviewTarget,
  isQuizTarget,
  isVideoExt,
  linkFor,
  type FileTab,
} from "./components/format";

// app/ratel/src/features/spaces/pages/apps/apps/file/views/home/mod.rs
// (`SpaceFileAppPage`, `/spaces/:spaceId/apps/files`) — the read-only file
// library: tabs filtering by link target, the file list, and image / video /
// audio previews. Suspends until the files and file links load
// (hooks/use_space_files.rs).
export function Component() {
  const tr = useSpaceFileI18n();
  const navigate = useNavigate();
  const { spaceId, space } = useSpaceAppsContext();

  const files = useGetSpaceFiles(spaceId, { throwOnError: true });
  const fileLinks = useListFileLinks(spaceId, { throwOnError: true });
  const [activeTab, setActiveTab] = useState<FileTab>("All");

  if (files.data === undefined || fileLinks.data === undefined) return null;

  const allFiles = files.data;
  const links = fileLinks.data;

  const displayedFiles =
    activeTab === "All"
      ? allFiles
      : activeTab === "Overview"
        ? filterByTarget(allFiles, links, isOverviewTarget)
        : activeTab === "Boards"
          ? filterByTarget(allFiles, links, isBoardTarget)
          : filterByTarget(allFiles, links, isQuizTarget);

  const imageFiles = displayedFiles.filter((f) => isImageExt(effectiveExt(f)));
  const videoFiles = displayedFiles.filter((f) => isVideoExt(effectiveExt(f)));
  const audioFiles = displayedFiles.filter((f) => isAudioExt(effectiveExt(f)));

  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;

  const tabButton = (tab: FileTab, testId: string, label: string) => (
    <button
      type="button"
      className="sfa-segmented__btn"
      aria-selected={dataBool(activeTab === tab)}
      data-testid={testId}
      onClick={() => setActiveTab(tab)}
    >
      {label}
    </button>
  );

  return (
    <div className="space-files-arena">
      <header className="sfa-topbar" role="banner">
        <div className="sfa-topbar__left">
          <button type="button" className="sfa-back-btn" aria-label="Back" data-testid="topbar-back" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <img className="sfa-topbar__logo" alt="Space logo" src={spaceLogo} />
          <nav className="sfa-breadcrumb">
            <span className="sfa-breadcrumb__item">{space.title}</span>
            <span className="sfa-breadcrumb__sep">›</span>
            <span className="sfa-breadcrumb__item">Apps</span>
            <span className="sfa-breadcrumb__sep">›</span>
            <span className="sfa-breadcrumb__item sfa-breadcrumb__current">File</span>
          </nav>
          <span className="sfa-type-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            File
          </span>
          <span className="sfa-topbar-title">File Library</span>
        </div>
      </header>

      <main className="sfa-body">
        <div className="sfa-tabs">
          <div className="sfa-segmented" data-testid="file-tabs">
            {tabButton("All", "tab-all", tr.tabAll)}
            {tabButton("Overview", "tab-overview", tr.tabOverview)}
            {tabButton("Boards", "tab-boards", tr.tabBoards)}
            {tabButton("Quiz", "tab-quiz", tr.tabQuiz)}
          </div>
          <div className="sfa-tabs__meta">
            <span className="sfa-tab-count" data-testid="file-count">
              <strong>{displayedFiles.length}</strong>
              files
            </span>
          </div>
        </div>

        <section className="sfa-section" data-testid="section-files">
          <div className="sfa-section__head">
            <span className="sfa-section__label">Files</span>
            <span className="sfa-section__hint">Click a card to open</span>
          </div>
          {displayedFiles.length === 0 ? (
            <div className="sfa-empty">
              <span className="sfa-empty__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span className="sfa-empty__title">{tr.noFiles}</span>
              <span className="sfa-empty__sub">Files shared in this space will appear here</span>
            </div>
          ) : (
            <div className="sfa-file-list" data-testid="file-list">
              {displayedFiles.map((file) => (
                <FileRow key={file.id} file={file} link={linkFor(file, links)} />
              ))}
            </div>
          )}
        </section>

        {imageFiles.length > 0 && (
          <section className="sfa-section" data-testid="section-image-preview">
            <div className="sfa-preview-group__head">
              <span className="sfa-preview-group__title">Image previews</span>
              <span className="sfa-preview-group__count">{imageFiles.length}</span>
            </div>
            <div className="sfa-preview-grid">
              {imageFiles.map((file) =>
                file.url ? (
                  <div key={`img-${file.id}`} className="sfa-preview-media">
                    <img src={file.url} alt={file.name} />
                    <span className="sfa-preview-media__label">{extLabel(effectiveExt(file))}</span>
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}

        {videoFiles.length > 0 && (
          <section className="sfa-section" data-testid="section-video-preview">
            <div className="sfa-preview-group__head">
              <span className="sfa-preview-group__title">Video previews</span>
              <span className="sfa-preview-group__count">{videoFiles.length}</span>
            </div>
            <div className="sfa-preview-grid" style={{ gridTemplateColumns: "1fr" }}>
              {videoFiles.map((file) =>
                file.url ? (
                  <div key={`video-${file.id}`} className="sfa-preview-media" style={{ aspectRatio: "16/7" }}>
                    {/* `nodownload`: the WebView download path is dead on Android/iOS. */}
                    <video src={file.url} controls controlsList="nodownload" />
                    <span className="sfa-preview-media__label">{extLabel(effectiveExt(file))}</span>
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}

        {audioFiles.length > 0 && (
          <section className="sfa-section" data-testid="section-audio-preview">
            <div className="sfa-preview-group__head">
              <span className="sfa-preview-group__title">Audio previews</span>
              <span className="sfa-preview-group__count">{audioFiles.length}</span>
            </div>
            <div className="sfa-audio-list">
              {audioFiles.map((file) =>
                file.url ? (
                  <div key={`audio-${file.id}`} className="sfa-audio-row">
                    <div className="sfa-audio-row__head">
                      <span className="sfa-audio-row__name">{file.name}</span>
                      <span className="sfa-audio-row__ext">{extLabel(effectiveExt(file))}</span>
                    </div>
                    <audio src={file.url} controls controlsList="nodownload" />
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="sfa-footer">
        <span className="sfa-footer__left">{`${allFiles.length} files total`}</span>
      </footer>
    </div>
  );
}
