import type { SamplingCellDto } from "@ratel/ts-bridges";
import { useSpaceSamplingI18n } from "../i18n";

/** Cell label: the option texts joined, or "all respondents" for the single cell of a config without sampling items. */
export function cellLabel(labels: string[], allRespondents: string): string {
  return labels.length === 0 ? allRespondents : labels.join(" · ");
}

/** Read-only table of the equal-allocation target of every cell. */
export function CellPreviewTable({ cells }: { cells: SamplingCellDto[] | null }) {
  const tr = useSpaceSamplingI18n();
  return (
    <section className="spa-section" data-testid="sampling-cell-preview">
      <div className="spa-section__head">
        <div className="spa-section__title">
          <span className="spa-section__label">{tr.previewLabel}</span>
        </div>
        <span className="spa-section__hint">{tr.allocationHint}</span>
      </div>
      {cells === null || cells.length === 0 ? (
        <div className="spa-table-empty">{tr.previewEmpty}</div>
      ) : (
        <div className="spa-table-wrap">
          <table className="spa-p-table">
            <thead>
              <tr>
                <th>{tr.colGroup}</th>
                <th>{tr.colTarget}</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => (
                <tr key={cell.cell_key} data-testid={`sampling-cell-row-${cell.position}`}>
                  <td data-testid={`sampling-cell-label-${cell.position}`}>{cellLabel(cell.labels, tr.allRespondents)}</td>
                  <td className="spa-num" data-testid={`sampling-cell-target-${cell.position}`}>
                    {cell.target}
                  </td>
                </tr>
              ))}
              <tr className="sampling-total-row">
                <td>{tr.totalRow}</td>
                <td className="spa-num" data-testid="sampling-cell-total">
                  {cells.reduce((sum, c) => sum + c.target, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
