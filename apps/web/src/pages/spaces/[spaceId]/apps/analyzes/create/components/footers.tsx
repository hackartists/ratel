import { useNavigate } from "react-router-dom";
import { useSpaceAnalyzesAppI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/analyzes/space-analyzes-app.i18n";
import { useAnalyzeCreateContext } from "../hooks/use-analyze-create";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/create/footer_create/component.rs
// and footer_preview/component.rs — page-level fixed footers, both always
// rendered and toggled with `hidden`.

export function FooterCreate() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();
  const navigate = useNavigate();

  return (
    <footer className="builder-actions builder-actions--create" id="footer-create" hidden={ctrl.mode !== "create"}>
      <div className="builder-actions__step">{tr.createFooterStepLabelCreate}</div>
      <div className="builder-actions__group">
        <button
          type="button"
          className="btn btn--ghost"
          id="create-cancel"
          data-testid="create-cancel"
          onClick={() => {
            ctrl.clearFilters();
            navigate(`/spaces/${ctrl.spaceId}/apps/analyzes`);
          }}
        >
          {tr.createFooterCancel}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          id="create-next"
          data-testid="create-next"
          onClick={() => {
            ctrl.handleComputePreview();
            ctrl.gotoPreview();
          }}
        >
          {tr.createFooterNext}
        </button>
      </div>
    </footer>
  );
}

export function FooterPreview() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();

  return (
    <footer className="builder-actions builder-actions--preview" id="footer-preview" hidden={ctrl.mode !== "preview"}>
      <div className="builder-actions__step">{tr.createFooterStepLabelPreview}</div>
      <div className="builder-actions__group">
        <button
          type="button"
          className="btn btn--ghost"
          id="preview-back"
          data-testid="preview-back"
          onClick={ctrl.backToCreate}
        >
          {tr.createFooterBack}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          id="preview-confirm"
          data-testid="preview-confirm"
          onClick={ctrl.handleSubmit}
        >
          {tr.createFooterConfirm}
        </button>
      </div>
    </footer>
  );
}
