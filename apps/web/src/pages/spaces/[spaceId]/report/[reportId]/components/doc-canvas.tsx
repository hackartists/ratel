import { useState } from "react";
import { Editor as RichEditor, type EditorSlashSignal } from "@/components/editor";
import { useLegacyScript } from "@/lib/legacy-scripts";
import { useReportDetailI18n } from "@/pages/spaces/[spaceId]/report/[reportId]/i18n";
import detailActionsScript from "../../../../../../legacy-scripts/features/spaces/pages/report/views/detail/detail_actions.js?url&no-inline";
import { focusBodyEditor } from "./chart-figure-html";
import { useReportDetailContext } from "../hooks/use-report-detail";

// app/ratel/src/features/spaces/pages/report/views/detail/doc_canvas.rs
//
// Doc-canvas surface — the editable body of the report:
// 1. `cover` strip (eyebrow label)
// 2. title / subtitle inputs (autosave via the debounced effect in the hook,
//    Enter focuses the body)
// 3. the shared `Editor` as the single rich-text body.

/** Chart figure action delegation (swap / delete buttons + slash-popup keyboard nav). */
function DetailActionsScript() {
  useLegacyScript(detailActionsScript);
  return null;
}

export function DocCanvas() {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();

  // Snapshot the body HTML once at first render — the Editor seeds its
  // content from this and never re-applies the prop (re-applying would
  // clobber the caret on every keystroke). `ctx.initialBodyHtml` is itself
  // already seeded once by the hook.
  const [initialBody] = useState(ctx.initialBodyHtml);
  const canEdit = ctx.canEdit;

  return (
    <>
      {/* Only mounted in edit mode — in viewer mode the figures have no
          swap/delete buttons so the listener has nothing to do. */}
      {canEdit && <DetailActionsScript />}

      <div className="report-detail__doc">
        <div className="report-detail__doc-inner">
          <div className="report-detail__cover">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>{ctx.eyebrow}</span>
          </div>
          {canEdit ? (
            <>
              <input
                className="report-detail__title"
                placeholder={tr.titlePlaceholder}
                value={ctx.title}
                onChange={(e) => ctx.setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusBodyEditor();
                  }
                }}
              />
              <input
                className="report-detail__subtitle"
                placeholder={tr.subtitlePlaceholder}
                value={ctx.subtitle}
                onChange={(e) => ctx.setSubtitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusBodyEditor();
                  }
                }}
              />
            </>
          ) : (
            // Viewer mode — title/subtitle render as static text rather than
            // `<input>` so the user can't focus or edit them. Class names
            // stay identical so the CSS typography matches the editor view.
            <>
              <h1 className="report-detail__title">{ctx.title}</h1>
              <div className="report-detail__subtitle">{ctx.subtitle}</div>
            </>
          )}
          <RichEditor
            className="report-detail__editor"
            content={initialBody}
            editable={canEdit}
            placeholder={tr.bodyPlaceholder}
            insertDataLabel={tr.insertData}
            onContentChange={(html) => {
              if (!canEdit) return;
              ctx.setBodyHtml(html);
            }}
            onInsertData={canEdit ? () => ctx.openDataPicker() : undefined}
            onSlash={canEdit ? (sig: EditorSlashSignal) => ctx.handleSlashSignal(sig) : undefined}
          />
        </div>
      </div>
    </>
  );
}
