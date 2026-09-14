import { useNavigate, useParams } from "react-router-dom";
import postEditScript from "../../../../legacy-scripts/features/posts/views/post_edit/script.js?url&no-inline";
import { CrossPostSidebar } from "@/components/cross-posting/cross-post-sidebar";
import { Editor } from "@/components/editor";
import { usePostEditI18n } from "@/i18n/generated/features/posts/views/post_edit/post-edit.i18n";
import { useAuth } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { useLegacyScript } from "@/lib/legacy-scripts";
import { usePopup } from "@/lib/popup";
import { DiscardDraftConfirm } from "./components/discard-draft-confirm";
import { PostingAs } from "./components/posting-as";
import { usePostEdit } from "./hooks/use-post-edit";

// app/ratel/src/features/posts/views/post_edit/component.rs (`PostEdit`,
// `/posts/:postId/edit`).

export function Component() {
  const { postId = "" } = useParams<{ postId: string }>();
  const tr = usePostEditI18n();
  const nav = useNavigate();
  const popup = usePopup();
  const auth = useAuth();
  useLegacyScript(postEditScript);

  const edit = usePostEdit(postId);

  if (!edit.ready) return null;

  const {
    title,
    setTitle,
    content,
    setContent,
    categories,
    tagInput,
    setTagInput,
    addTag,
    removeTag,
    postKind,
    setPostKind,
    visibility,
    setVisibility,
    spaceEnabled,
    setSpaceEnabled,
    hasExistingSpace,
    alreadyPublishedPublic,
    drawerOpen,
    setDrawerOpen,
    asDropdownOpen,
    setAsDropdownOpen,
    userAvatar,
    userLabel,
    teams,
    selectedTeamPk,
    switchAuthor,
    status,
    contentTextChars,
    contentWordCount,
    canSubmit,
    crossPosting,
    commitPublish,
    commitSaveDraft,
    discardDraft,
  } = edit;

  const spaceOn = spaceEnabled || hasExistingSpace;
  const publishLabel = spaceOn ? tr.designSpace : tr.publish;

  const statusLine =
    status === "idle"
      ? ""
      : status === "saving"
        ? tr.saving
        : status === "saved"
          ? tr.allChangesSaved
          : status === "unsaved"
            ? tr.unsavedChanges
            : tr.publishing;

  const autosaveLabel =
    status === "saved" || status === "idle"
      ? `${tr.autosaved} ${tr.justNow}`
      : status === "saving"
        ? tr.saving
        : status === "unsaved"
          ? tr.unsavedChanges
          : tr.publishing;

  const username = auth.userContext.user?.username ?? "";

  const onCpConnect = async (platform: "bluesky" | "linkedin" | "threads") => {
    if (platform === "linkedin") {
      await crossPosting.connectLinkedin(`/posts/${postId}/edit`);
    } else {
      nav(`/${username}/settings/connections`);
    }
  };

  const openDiscardConfirm = () => {
    popup.open(
      <DiscardDraftConfirm
        tr={tr}
        onCancel={() => popup.close()}
        onConfirm={() => {
          void discardDraft().then(() => popup.close());
        }}
      />,
    );
  };

  return (
    <div className="composer-arena">
      <div className="arena-topbar">
        <div className="arena-topbar__left">
          <button className="back-btn" aria-label={tr.back} onClick={() => nav(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="topbar-title">
            <span className="topbar-title__eyebrow">{tr.pageEyebrow}</span>
            <span className="topbar-title__main">{tr.pageTitle}</span>
          </div>
        </div>
        <div className="arena-topbar__right">
          <span className="autosave">{autosaveLabel}</span>
          <button
            className="topbar-btn"
            disabled={status === "saving" || status === "publishing"}
            onClick={commitSaveDraft}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {tr.saveDraft}
          </button>
          <button
            className="topbar-btn topbar-btn--primary"
            data-testid="post-edit-publish-btn"
            data-space={dataBool(spaceOn)}
            disabled={!canSubmit}
            onClick={commitPublish}
          >
            {spaceOn ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
            <span>{publishLabel}</span>
          </button>
        </div>
      </div>

      <div className="composer-page">
        <main className="composer">
          <div className="type-segmented" role="tablist" aria-label="Post type">
            <button className="type-seg" role="tab" aria-selected={dataBool(postKind === "post")} onClick={() => setPostKind("post")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {tr.typePost}
            </button>
            <button className="type-seg" role="tab" aria-selected={dataBool(postKind === "repost")} aria-disabled="true" title={tr.comingSoon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              {tr.typeRepost}
              <span className="type-seg__soon">{tr.comingSoon}</span>
            </button>
            <button className="type-seg" role="tab" aria-selected={dataBool(postKind === "artwork")} aria-disabled="true" title={tr.comingSoon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              {tr.typeArtwork}
              <span className="type-seg__soon">{tr.comingSoon}</span>
            </button>
          </div>

          <div>
            <input
              className="title-input"
              type="text"
              placeholder={tr.titlePlaceholder}
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="title-divider" />
          </div>

          <Editor
            className="w-full"
            content={content}
            editable
            placeholder={tr.bodyPlaceholder}
            onContentChange={setContent}
          />
        </main>

        <aside className="side-panel" id="post-side-panel" data-open={dataBool(drawerOpen)}>
          <div className="side-panel__head">
            <span className="side-panel__handle" />
            <span className="side-panel__title">{tr.postOptions}</span>
            <button className="side-panel__close" aria-label={tr.closeOptions} onClick={() => setDrawerOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <PostingAs
            tr={tr}
            userAvatar={userAvatar}
            userLabel={userLabel}
            teams={teams}
            selectedTeamPk={selectedTeamPk}
            open={asDropdownOpen}
            onOpenChange={setAsDropdownOpen}
            onSwitch={(teamPk) => void switchAuthor(teamPk)}
          />

          <div className="side-card space-toggle" data-on={dataBool(spaceEnabled)}>
            <div className="space-toggle__head">
              <div className="side-card__title" style={{ margin: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                {tr.enableSpace}
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={dataBool(spaceEnabled)}
                aria-label={tr.enableSpace}
                disabled={hasExistingSpace}
                onClick={() => {
                  if (!hasExistingSpace) setSpaceEnabled(!spaceEnabled);
                }}
              />
            </div>
            <div className="space-toggle__hint">{tr.spaceHint}</div>
            <div className="space-toggle__active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {tr.spaceActiveHint}
            </div>
          </div>

          <div className="side-card">
            <div className="side-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              </svg>
              {tr.tags}
            </div>
            <div className="tag-input" data-testid="tag-input">
              {categories.map((tag) => (
                <span key={tag} className="tag" data-testid="post-tag" data-tag-value={tag}>
                  {tag}
                  <button
                    className="tag__x"
                    data-testid="post-tag-remove"
                    data-tag-value={tag}
                    aria-label={tr.removeTag}
                    onClick={() => removeTag(tag)}
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
                data-testid="tag-input-field"
                type="text"
                placeholder={tr.tagPlaceholder}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagInput);
                    setTagInput("");
                  }
                }}
              />
            </div>
          </div>

          <div className="side-card">
            <div className="side-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {tr.visibility}
            </div>
            <div className="vis-row">
              <button className="vis-opt" aria-selected={dataBool(visibility === "PUBLIC")} onClick={() => setVisibility("PUBLIC")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>{tr.visibilityPublic}</span>
              </button>
              <button className="vis-opt" aria-selected={dataBool(visibility === "PRIVATE")} onClick={() => setVisibility("PRIVATE")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>{tr.visibilityPrivate}</span>
              </button>
            </div>
            {alreadyPublishedPublic && visibility === "PRIVATE" && (
              <div className="syndication-remain-notice" role="note" data-testid="syndication-remain-notice">
                <div className="syndication-remain-notice__title" data-testid="syndication-remain-notice-title">
                  {tr.visibilitySyndicatedRemainTitle}
                </div>
                <div className="syndication-remain-notice__body">{tr.visibilitySyndicatedRemainBody}</div>
              </div>
            )}
          </div>

          <button className="danger-row" onClick={openDiscardConfirm}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            {tr.discardDraft}
          </button>

          {visibility === "PUBLIC" && (
            <CrossPostSidebar content={content} crossPosting={crossPosting} onConnectRequest={(p) => void onCpConnect(p)} />
          )}
        </aside>
      </div>

      <div className="drawer-backdrop" data-open={dataBool(drawerOpen)} onClick={() => setDrawerOpen(false)} />

      <div className="bottom-bar">
        <div className="bottom-bar__left">
          <span className="bottom-bar__stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <strong>{contentWordCount}</strong> {tr.statWords} · <strong>{contentTextChars}</strong> {tr.statChars}
          </span>
          <span className="bottom-bar__stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {statusLine}
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
            {tr.options}
          </button>
          <button
            className="bottom-bar__btn bottom-bar__btn--mobile bottom-bar__btn--primary"
            data-testid="post-edit-publish-btn-mobile"
            data-space={dataBool(spaceOn)}
            disabled={!canSubmit}
            onClick={commitPublish}
          >
            {spaceOn ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
            <span>{publishLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
