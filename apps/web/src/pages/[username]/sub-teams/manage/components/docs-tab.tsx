import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { SubTeamDocumentResponse, UpdateSubTeamDocumentRequest } from "@ratel/ts-bridges";
import { FileText } from "@/components/icons/lucide";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { dataBool } from "@/lib/dom";
import { charCount, formatYmd, prettySize, stripHtmlToPlain, totalAttachmentBytes } from "../hooks/format";
import { useDomProp } from "../hooks/use-dom-value";
import { EMPTY_DOC_UPDATE, useSubTeamDocs } from "../hooks/use-sub-team-docs";
import { useSubTeamManagement } from "../hooks/use-sub-team-management";

// app/ratel/src/features/sub_team/pages/management/docs_tab.rs (`DocsTab`).

/** `format_updated_date`. */
function formatUpdatedDate(updatedAt: number): string {
  if (updatedAt <= 0) return "";
  return formatYmd(updatedAt);
}

export function DocsTab({ category }: { category: string }) {
  const tr = useSubTeamI18n();
  const { teamId, username } = useSubTeamManagement();
  const { docs, handleUpdate, handleDelete, handleReorder } = useSubTeamDocs(teamId);
  const navigate = useNavigate();

  const items = docs.items;
  const itemCount = items.length;
  const requiredCount = items.filter((d) => d.required).length;

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">{tr.docsCardTitle}</h2>
        <span className="card__dash" />
        <span className="card__meta">{`${itemCount} documents · ${requiredCount} ${tr.requiredReading}`}</span>
        <div
          className="card-head__link"
          data-testid="sub-team-docs-view-bylaws"
          role="link"
          onClick={() => {
            // Route::TeamBylawsPage
            navigate(`/${encodeURIComponent(username)}/bylaws`);
          }}
        >
          <FileText className="w-3 h-3 [&>path]:stroke-current" />
          {tr.docsViewBylaws}
        </div>
      </div>

      <div className="notice" style={{ marginBottom: "10px" }}>
        <div className="notice__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="notice__body">
          <span className="notice__title">{tr.docsBannerTitle}</span>
          <span className="notice__text">{tr.docsBannerText}</span>
        </div>
      </div>

      <div className="doc-list" id="doc-list">
        {items.map((doc, idx) => (
          <DocItem
            key={doc.id}
            doc={doc}
            isFirst={idx === 0}
            isLast={idx + 1 === itemCount}
            rowsSnapshot={items}
            idx={idx}
            username={username}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        ))}
      </div>

      <button
        className="add-doc-btn"
        id="add-doc"
        data-testid="sub-team-doc-add-btn"
        style={{ marginTop: "12px" }}
        onClick={() => {
          // Route::TeamSubTeamBylawsComposePage — every doc gets a category so
          // the dual-write (SubTeamDocument + backing Post) always fires.
          navigate(`/${encodeURIComponent(username)}/bylaws/compose/${encodeURIComponent(category)}`);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {tr.docsAddBtn}
      </button>
    </section>
  );
}

interface DocItemProps {
  doc: SubTeamDocumentResponse;
  isFirst: boolean;
  isLast: boolean;
  rowsSnapshot: SubTeamDocumentResponse[];
  idx: number;
  username: string;
  onUpdate: (docId: string, req: UpdateSubTeamDocumentRequest) => void;
  onDelete: (docId: string) => void;
  onReorder: (ids: string[]) => void;
}

function DocItem({ doc, isFirst, isLast, rowsSnapshot, idx, username, onUpdate, onDelete, onReorder }: DocItemProps) {
  const tr = useSubTeamI18n();
  const navigate = useNavigate();

  // Doc body is rich-text HTML: strip tags before truncating.
  const bodyPlain = stripHtmlToPlain(doc.body);
  const bodyPreview = Array.from(bodyPlain).slice(0, 180).join("");
  const required = doc.required;
  const chars = charCount(bodyPlain);
  const attachmentCount = doc.attachments.length;
  const sizeLabel = prettySize(totalAttachmentBytes(doc.attachments));
  const updatedLabel = formatUpdatedDate(doc.updated_at);

  const requiredRef = useRef<HTMLInputElement>(null);
  useDomProp(requiredRef, "checked", required);

  const swap = (a: number, b: number) => {
    const ids = rowsSnapshot.map((d) => d.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    return ids;
  };

  return (
    <div className="doc-item" data-required={dataBool(required)} data-testid="sub-team-doc-item">
      <div className="doc-item__head">
        <span className="doc-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <input className="doc-item__title" type="text" data-testid="sub-team-doc-title" value={doc.title} readOnly />
        {updatedLabel !== "" && <span className="doc-item__updated">{`${updatedLabel} ${tr.docsUpdatedSuffix}`}</span>}
        <label className="doc-item__req">
          <input
            ref={requiredRef}
            type="checkbox"
            data-testid="sub-team-doc-required-check"
            defaultChecked={required}
            onChange={(e) => onUpdate(doc.id, { ...EMPTY_DOC_UPDATE, required: e.currentTarget.checked })}
          />
          <span className="doc-item__req-pill">{tr.requiredReading}</span>
        </label>
        <a
          className="doc-item__edit"
          data-testid="sub-team-doc-edit-btn"
          onClick={() => {
            // Route::TeamSubTeamDocEditPage
            navigate(`/${encodeURIComponent(username)}/sub-teams/docs/${encodeURIComponent(doc.id)}/edit`);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
          {tr.docsEditBtn}
        </a>
        <div className="doc-item__actions">
          <button
            className="doc-item__btn"
            aria-label="Move up"
            disabled={isFirst}
            onClick={() => {
              if (isFirst) return;
              onReorder(swap(idx, idx - 1));
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            className="doc-item__btn"
            aria-label="Move down"
            disabled={isLast}
            onClick={() => {
              if (isLast) return;
              onReorder(swap(idx, idx + 1));
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button className="doc-item__btn doc-item__btn--danger" aria-label="Delete" onClick={() => onDelete(doc.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="doc-item__preview">{bodyPreview}</div>

      <div className="doc-item__foot">
        <span className="doc-item__stats">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {`${chars}${tr.docComposeStatsChars}`}
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            {`${attachmentCount} ${tr.docComposeAttachFilesUnit}`}
            {attachmentCount > 0 && ` · ${sizeLabel}`}
          </span>
        </span>
        <span className="doc-item__hint">
          {required
            ? `${tr.docComposeRequiredOn} · ${tr.docComposeRequiredDescShort}`
            : `${tr.docComposeRequiredOff} · ${tr.docComposeReferenceOnly}`}
        </span>
      </div>
    </div>
  );
}
