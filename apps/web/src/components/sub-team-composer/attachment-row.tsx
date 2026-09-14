import type { File as SubTeamFile } from "@ratel/ts-bridges";
import { fileExtLabel, fileIconModifier } from "./utils";

// `AttachmentRow` from
// app/ratel/src/features/sub_team/pages/doc_compose/component.rs.

export interface AttachmentRowProps {
  file: SubTeamFile;
  onRemove: () => void;
}

export function AttachmentRow({ file, onRemove }: AttachmentRowProps) {
  const iconModifier = fileIconModifier(file.ext);
  const iconClass = `file-row__icon ${iconModifier}`;
  const extLabel = fileExtLabel(file.ext);
  const downloadHref = file.url ?? "";
  const downloadTarget = downloadHref === "" ? undefined : "_blank";

  return (
    <div className="file-row" data-testid="sub-team-doc-attach-row">
      <div className={iconClass}>
        {file.ext === "JPG" || file.ext === "PNG" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        )}
      </div>
      <a className="file-row__body" href={downloadHref} target={downloadTarget} rel="noopener noreferrer">
        <div className="file-row__name">{file.name}</div>
        <div className="file-row__meta">
          {extLabel} · <strong>{file.size}</strong>
        </div>
      </a>
      <span className="file-row__progress">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Uploaded
      </span>
      <button className="file-row__del" aria-label="Remove file" type="button" onClick={onRemove}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
