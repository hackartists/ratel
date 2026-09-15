import { useEffect, useRef, useState } from "react";
import type { File as RatelFile, UpdateQuizRequest } from "@ratel/ts-bridges";
import { createFileLink, removeQuizFile } from "@ratel/ts-bridges";
import { useUpdateQuiz } from "@ratel/ts-bridges/hooks";
import { ActionDescriptionEditor } from "@/components/space-actions/action-description-editor";
import { AutosaveStatusBadge, type SaveStatus } from "@/components/space-actions/autosave-status-badge";
import { FileUploader } from "@/components/ui/file-uploader";
import { FileExtension, FileExtensionIcon } from "@/components/ui/file-extension-icon";
import { useQuizCreatorI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/quiz/views/main/creator/quiz-creator.i18n";
import { extractFilenameFromUrl, fileExtensionFromNameOrUrl } from "@/lib/file-ext";
import { useToast } from "@/lib/toast";
import { useQuiz } from "../hooks/use-quiz";

// quiz/views/main/creator/content_card/component.rs (`ContentCard`) — title,
// rich description, attachments, and the pass-score/retry-count scoring row.

function emptyUpdate(): UpdateQuizRequest {
  return { title: null, description: null, retry_count: null, pass_score: null, questions: null, answers: null, files: null };
}

function iconClass(ext: RatelFile["ext"]): string {
  if (ext === FileExtension.PDF) return "file-row__icon file-row__icon--pdf";
  if (ext === FileExtension.JPG || ext === FileExtension.PNG) return "file-row__icon file-row__icon--img";
  if (ext === FileExtension.WORD || ext === FileExtension.EXCEL || ext === FileExtension.PPTX) return "file-row__icon file-row__icon--doc";
  return "file-row__icon";
}

export function QuizContentCard() {
  const tr = useQuizCreatorI18n();
  const toast = useToast();
  const { spaceId, quizId, quiz, refreshQuiz, retryCount, setRetryCount, passScore, setPassScore, questions } = useQuiz();
  const update = useUpdateQuiz();

  const [title, setTitle] = useState(quiz.title);
  const lastSavedTitle = useRef(quiz.title);
  const [titleStatus, setTitleStatus] = useState<SaveStatus>("Idle");

  const [description, setDescription] = useState(quiz.description);
  const lastSavedDescription = useRef(quiz.description);
  const [descriptionStatus, setDescriptionStatus] = useState<SaveStatus>("Idle");

  const [files, setFiles] = useState<RatelFile[]>(quiz.files);

  const totalQuestions = questions.length;

  const saveFilesAfterUpload = (next: RatelFile[]) => {
    update.mutateAsync({ spacePk: spaceId, quizId, req: { ...emptyUpdate(), files: next } }).catch((err) => toast.error(err));
  };

  const saveScoring = () => {
    update
      .mutateAsync({ spacePk: spaceId, quizId, req: { ...emptyUpdate(), pass_score: passScore, retry_count: retryCount } })
      .then(refreshQuiz)
      .catch((err) => toast.error(err));
  };

  const saveTitle = (current: string) => {
    if (current === lastSavedTitle.current) return;
    setTitleStatus("Saving");
    update
      .mutateAsync({ spacePk: spaceId, quizId, req: { ...emptyUpdate(), title: current } })
      .then(() => {
        lastSavedTitle.current = current;
        setTitleStatus("Saved");
        refreshQuiz();
      })
      .catch((err) => {
        setTitleStatus("Unsaved");
        toast.error(err);
      });
  };

  const saveDescription = (current: string) => {
    if (current === lastSavedDescription.current) return;
    setDescriptionStatus("Saving");
    update
      .mutateAsync({ spacePk: spaceId, quizId, req: { ...emptyUpdate(), description: current } })
      .then(() => {
        lastSavedDescription.current = current;
        setDescriptionStatus("Saved");
        refreshQuiz();
      })
      .catch((err) => {
        setDescriptionStatus("Unsaved");
        toast.error(err);
      });
  };

  const titleTimer = useRef<number | null>(null);
  const descriptionTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (titleTimer.current !== null) window.clearTimeout(titleTimer.current);
      if (descriptionTimer.current !== null) window.clearTimeout(descriptionTimer.current);
    },
    [],
  );

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
              data-testid="quiz-title"
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
              className="[&_.re-toolbar]:border-b [&_.re-toolbar]:border-[rgba(255,255,255,0.06)] [&_.re-content]:min-h-[180px] [&_.re-content]:px-[22px] [&_.re-content]:py-[20px] [&_.re-content]:outline-none"
              content={description}
              editable
              placeholder=""
              onContentChange={(html) => {
                setDescription(html);
                if (html !== lastSavedDescription.current) {
                  setDescriptionStatus("Unsaved");
                  if (descriptionTimer.current !== null) window.clearTimeout(descriptionTimer.current);
                  descriptionTimer.current = window.setTimeout(() => saveDescription(html), 3000);
                }
              }}
            />
            <div className="editor__footer">
              <AutosaveStatusBadge
                status={descriptionStatus}
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
                    removeQuizFile(spaceId, quizId, { file_url: file.id })
                      .then(refreshQuiz)
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
              createFileLink(spaceId, { file_url: url, file_name: uploadedName, link_target: `QUIZ#${quizId}` })
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

        <section className="section" data-testid="section-scoring">
          <div className="section__head">
            <span className="section__label">{tr.sectionScoringLabel}</span>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="field__label">{tr.passScoreLabel}</label>
              <div className="input-group">
                <input
                  className="input input--num"
                  type="number"
                  min="0"
                  data-testid="quiz-pass-score"
                  value={passScore}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) setPassScore(v);
                  }}
                  onBlur={saveScoring}
                />
                <span className="input-suffix">{`/ ${totalQuestions} ${tr.questionsSuffix}`}</span>
              </div>
            </div>
            <div className="field">
              <label className="field__label">{tr.retryCountLabel}</label>
              <div className="input-group">
                <input
                  className="input input--num"
                  type="number"
                  min="0"
                  data-testid="quiz-retry-count"
                  value={retryCount}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) setRetryCount(v);
                  }}
                  onBlur={saveScoring}
                />
                <span className="input-suffix">{tr.retriesSuffix}</span>
              </div>
            </div>
          </div>
        </section>
      </article>
    </section>
  );
}
