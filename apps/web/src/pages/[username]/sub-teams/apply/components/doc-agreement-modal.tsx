import type { ApplyContextDocument } from "@ratel/ts-bridges";
import { Check, FileText, Info, Paperclip, X } from "@/components/icons/lucide";
import { dataBool } from "@/lib/dom";
import { useSubTeamI18n } from "@/pages/[username]/sub-teams/sub-team.i18n";

// app/ratel/src/features/sub_team/pages/apply/doc_agreement_modal/component.rs
// (`DocAgreementModal`) — overlay shown when the applicant clicks a required
// document row. Reference-only docs (`required: false`) render read-only
// (no Agree button, Close label instead of Cancel).

export interface DocAgreementModalProps {
  open: boolean;
  doc: ApplyContextDocument;
  alreadyAgreed: boolean;
  index: number;
  total: number;
  onCancel: () => void;
  onAgree: () => void;
}

export function DocAgreementModal({ open, doc, alreadyAgreed, index, total, onCancel, onAgree }: DocAgreementModalProps) {
  const t = useSubTeamI18n();
  const isRequired = doc.required;

  return (
    <div
      className="modal-backdrop sub-team-apply-doc-modal"
      data-open={dataBool(open)}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div className="modal doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doc-modal__head">
          <span className="doc-modal__icon">
            <FileText className="w-4 h-4 [&>path]:stroke-current" />
          </span>
          <div className="doc-modal__title-wrap">
            <div className="doc-modal__kicker">{t.docModalEyebrow}</div>
            <div className="doc-modal__title">{doc.title}</div>
          </div>
          <button type="button" className="doc-modal__close-x" aria-label={t.cancel} onClick={onCancel}>
            <X className="w-4 h-4 [&>path]:stroke-current" />
          </button>
        </div>
        <div className="doc-modal__body">
          {/* SAFETY: doc.body is rich-text sanitized server-side (allowlist) at compose time. */}
          <div className="doc-modal__content" dangerouslySetInnerHTML={{ __html: doc.body }} />
          {doc.attachments.length > 0 && (
            <div className="doc-modal__attachments">
              {doc.attachments.map((file) => (
                <a
                  key={file.id}
                  className="doc-modal__attachment"
                  href={file.url ?? ""}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Paperclip className="w-3 h-3 [&>path]:stroke-current" />
                  <span className="doc-modal__attachment-name">{file.name}</span>
                  <span className="doc-modal__attachment-size">{file.size}</span>
                </a>
              ))}
            </div>
          )}
          <div className="doc-modal__notice">
            <Info className="w-4 h-4 [&>path]:stroke-current" />
            <div className="doc-modal__notice-text">{t.docModalNotice}</div>
          </div>
        </div>
        <div className="doc-modal__foot">
          <div className="doc-modal__foot-left">
            {index} / {total}
          </div>
          <div className="doc-modal__foot-actions">
            <button type="button" className="doc-modal__cancel" onClick={onCancel}>
              {isRequired ? t.docModalCancel : t.applyClose}
            </button>
            {isRequired && (
              <button
                type="button"
                className="doc-modal__agree-btn"
                data-agreed={dataBool(alreadyAgreed)}
                data-testid="doc-agreement-agree-btn"
                disabled={alreadyAgreed}
                onClick={onAgree}
              >
                <Check className="w-3 h-3 [&>path]:stroke-current" />
                {alreadyAgreed ? t.docModalAgreed : t.docModalAgree}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
