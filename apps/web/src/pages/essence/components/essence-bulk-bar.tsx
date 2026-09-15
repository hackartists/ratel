import { useEssenceSourcesI18n } from "@/i18n/generated/features/essence/pages/sources/essence-sources.i18n";
import { dataBool } from "@/lib/dom";
import { useEssenceSources } from "../hooks/use-essence-sources";

// app/ratel/src/features/essence/pages/sources/bulk_bar/component.rs
export function EssenceBulkBar() {
  const tr = useEssenceSourcesI18n();
  const { selectedRows, bulkRemove } = useEssenceSources();
  const count = selectedRows.size;

  return (
    <div className="essence-bulk" data-open={dataBool(count > 0)}>
      <span className="essence-bulk__count">
        <strong>{count}</strong>
        {` ${tr.bulkSelectedSuffix}`}
      </span>
      <div className="essence-bulk__actions">
        <button className="essence-bulk-btn essence-bulk-btn--danger" onClick={bulkRemove}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          </svg>
          {tr.bulkRemove}
        </button>
      </div>
    </div>
  );
}
