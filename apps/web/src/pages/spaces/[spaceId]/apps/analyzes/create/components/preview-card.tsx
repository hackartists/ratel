import { RecordsTable } from "@/components/analyzes/records-table";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { typeLabel, useAnalyzeCreateContext } from "../hooks/use-analyze-create";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/create/preview_card/component.rs
// PREVIEW step: name input, chip summary, count tiles, and one sample
// records table per chip.

export function PreviewCard() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();
  const { filters, preview } = ctrl;

  const respondents = preview ? String(preview.respondent_count) : "—";
  const dataCount = preview ? String(preview.data_count) : "—";
  const sampleRecords = preview?.sample_records ?? [];

  return (
    <div className="builder-create" data-state="preview">
      <header className="cross-filter__head" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <h2 className="cross-filter__title">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {tr.createPreviewTitle}
        </h2>
        <p className="cross-filter__hint">{tr.createPreviewHint}</p>
      </header>

      <span className="builder-label">{tr.createPreviewNameLabel}</span>
      <input
        type="text"
        className="builder-name-input"
        id="preview-name"
        data-testid="preview-name"
        placeholder={tr.createPreviewNamePlaceholder}
        value={ctrl.previewName}
        onChange={(e) => ctrl.setPreviewName(e.target.value)}
      />
      <span className="builder-hint">{tr.createPreviewNameHint}</span>

      <span className="builder-label">{tr.createPreviewChipsLabel}</span>
      <div className="preview-chips" id="preview-chips">
        {filters.length === 0 ? (
          <span className="cross-filter__chips-all">{tr.createCfChipsAll}</span>
        ) : (
          filters.map((f, idx) => (
            <span key={`preview-chip-${idx}`} className="preview-chip" data-source={f.source}>
              <span className="preview-chip__source">{typeLabel(f.source)}</span>
              <span>{f.label}</span>
            </span>
          ))
        )}
      </div>

      <div className={filters.length === 0 ? "preview-stats preview-stats--solo" : "preview-stats"}>
        <div className="preview-stat">
          <span className="preview-stat__value" id="preview-count" data-testid="preview-count">
            {respondents}
          </span>
          <span className="preview-stat__label">{tr.createPreviewStatRespondents}</span>
        </div>
        {filters.length > 0 && (
          <div className="preview-stat">
            <span className="preview-stat__value" id="preview-data-count" data-testid="preview-data-count">
              {dataCount}
            </span>
            <span className="preview-stat__label">{tr.createPreviewStatRecords}</span>
          </div>
        )}
      </div>

      {filters.length > 0 && (
        <>
          <span className="builder-label">{tr.createPreviewRecordsLabel}</span>
          <span className="builder-hint">{tr.createPreviewRecordsLimitHint}</span>
          {sampleRecords.length === 0 ? (
            <span className="builder-hint">{tr.createPreviewRecordsEmpty}</span>
          ) : (
            <div className="preview-records-groups">
              {filters.map((f, idx) => {
                const group = sampleRecords.filter((r) => r.filter_idx === idx);
                return (
                  <div key={`preview-records-group-${idx}`} className="preview-records-group">
                    <div className="preview-records-group__head">
                      <span className="preview-chip" data-source={f.source}>
                        <span className="preview-chip__source">{f.source_label}</span>
                        <span>{f.label}</span>
                      </span>
                    </div>
                    {group.length === 0 ? (
                      <div className="preview-records-group__empty">{tr.recordsEmpty}</div>
                    ) : (
                      <RecordsTable source={f.source} rows={group} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
