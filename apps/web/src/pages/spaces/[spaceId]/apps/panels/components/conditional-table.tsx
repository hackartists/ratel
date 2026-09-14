import type { PanelAttribute } from "@ratel/ts-bridges";
import { useState } from "react";
import { usePanelsI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/panels/panels.i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { AGE_MAX, panelAttributes } from "../hooks/panel-logic";
import { useSpacePanels } from "../hooks/use-space-panels";

// panels/views/home/conditional_table.rs — the conditional (quota-carrying)
// rows: group swatch, attribute pills, share of the total, an editable max
// quota (saved on Enter / blur) and a delete button; warns when the rows'
// quotas exceed the space's total.

type RowAxis = "uni" | "age" | "gen" | "mix";
type PanelsI18n = ReturnType<typeof usePanelsI18n>;

/** `row_axis`. */
function rowAxis(attrs: PanelAttribute[]): RowAxis {
  let hasAge = false;
  let hasGen = false;
  let hasUni = false;
  for (const a of attrs) {
    if (a.type === "verifiable_attribute") {
      if (a.value.type === "age") hasAge = true;
      if (a.value.type === "gender") hasGen = true;
    } else if (a.type === "collective_attribute") {
      if (a.value === "age") hasAge = true;
      if (a.value === "gender") hasGen = true;
      if (a.value === "university") hasUni = true;
    }
  }
  if (hasAge && hasGen) return "mix";
  if (hasAge && !hasGen && !hasUni) return "age";
  if (!hasAge && hasGen && !hasUni) return "gen";
  if (!hasAge && !hasGen && hasUni) return "uni";
  return "mix";
}

/** `group_label`: distinct attribute group names, or "-". */
function groupLabel(attrs: PanelAttribute[], tr: PanelsI18n): string {
  const names: string[] = [];
  for (const a of attrs) {
    let name: string | null = null;
    if (a.type === "collective_attribute") {
      if (a.value === "university") name = tr.attrUniversity;
      else if (a.value === "age") name = tr.attrAge;
      else if (a.value === "gender") name = tr.attrGender;
    } else if (a.type === "verifiable_attribute") {
      if (a.value.type === "age") name = tr.attrAge;
      else if (a.value.type === "gender") name = tr.attrGender;
      else if (a.value.type === "generation") name = tr.valGeneration;
    }
    if (name !== null && !names.includes(name)) names.push(name);
  }
  return names.length === 0 ? "-" : names.join(", ");
}

/** Rust `{gen:?}` of `AgeGeneration`: the variant name. */
function debugGeneration(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** `attribute_pill`: (class, text), or `null` for attributes without a pill. */
function attributePill(a: PanelAttribute, tr: PanelsI18n): { className: string; label: string } | null {
  if (a.type === "collective_attribute") {
    return a.value === "university" ? { className: "spa-attr-pill spa-attr-pill--uni", label: tr.valVerified } : null;
  }
  if (a.type !== "verifiable_attribute") return null;
  const v = a.value;
  switch (v.type) {
    case "age": {
      let label: string;
      if (v.value.age_type === "specific") label = String(v.value.value);
      else {
        const { inclusive_min: min, inclusive_max: max } = v.value.value;
        if (min === 70 && max === AGE_MAX) label = "70+";
        else if (min === 0 && max === 17) label = `${tr.valMinor} (0-17)`;
        else label = `${min}-${max}`;
      }
      return { className: "spa-attr-pill spa-attr-pill--age", label };
    }
    case "gender":
      return { className: "spa-attr-pill spa-attr-pill--gen", label: v.value === "male" ? tr.valMale : tr.valFemale };
    case "is_adult":
      return { className: "spa-attr-pill spa-attr-pill--age", label: v.value ? tr.valAdult : tr.valMinor };
    case "generation":
      return { className: "spa-attr-pill spa-attr-pill--age", label: debugGeneration(v.value) };
    default:
      return null;
  }
}

export function ConditionalTableSection() {
  const tr = usePanelsI18n();
  const { space } = useSpaceAppsContext();
  const { panels, updateRowQuota, deleteRow } = useSpacePanels();

  const visible = panels.filter((p) =>
    panelAttributes(p).some(
      (a) =>
        a.type === "verifiable_attribute" &&
        (a.value.type === "gender" || a.value.type === "age" || a.value.type === "generation" || a.value.type === "is_adult"),
    ),
  );

  const totalVisible = visible.reduce((sum, p) => sum + Math.max(p.quotas, 0), 0);
  const overAllocated = space.quota > 0 && totalVisible > space.quota;

  // Pending edits per row id (digits); cleared on commit.
  const [editing, setEditing] = useState<Record<string, string>>({});

  const commitRow = (rowId: string, fallback: number) => {
    const parsed = Number.parseInt(editing[rowId] ?? "", 10);
    const next = Number.isNaN(parsed) ? fallback : parsed;
    setEditing((map) => {
      const rest = { ...map };
      delete rest[rowId];
      return rest;
    });
    updateRowQuota.call(rowId, next);
  };

  return (
    <section className="spa-section" data-testid="section-conditional">
      <div className="spa-section__head">
        <div className="spa-section__title">
          <span className="spa-section__label">{tr.conditionalTitle}</span>
        </div>
        <span className="spa-section__hint">{tr.conditionalHint}</span>
      </div>

      {overAllocated && (
        <div className="spa-warn" data-testid="ratio-warning">
          <span className="spa-warn__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <span>
            <strong>{tr.conditionalOverAllocated}</strong>
            {tr.conditionalOverAllocatedDetail}
          </span>
        </div>
      )}

      <div className="spa-table-wrap">
        <table className="spa-p-table" data-testid="conditional-table">
          <thead>
            <tr>
              <th>{tr.thAttributeGroup}</th>
              <th>{tr.thAttributes}</th>
              <th>{tr.thRatio}</th>
              <th className="spa-num">{tr.thMaxQuotas}</th>
              <th className="spa-action"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="spa-table-empty" colSpan={5}>
                  {tr.conditionalEmpty}
                </td>
              </tr>
            ) : (
              visible.map((panel) => {
                const attrs = panelAttributes(panel);
                const axis = rowAxis(attrs);
                const rowId = panel.panel_id;
                const ratio = totalVisible > 0 ? Math.round((panel.quotas / totalVisible) * 1000) / 10 : 0;
                const displayed = editing[rowId] ?? String(panel.quotas);

                return (
                  <tr key={rowId}>
                    <td>
                      <span className={`spa-p-table__group spa-p-table__group--${axis}`}>
                        <span className="spa-p-table__swatch" />
                        {groupLabel(attrs, tr)}
                      </span>
                    </td>
                    <td>
                      {attrs.map((attr, idx) => {
                        const pill = attributePill(attr, tr);
                        return pill ? (
                          <span key={idx} className={pill.className}>
                            {pill.label}
                          </span>
                        ) : null;
                      })}
                    </td>
                    <td>
                      <span className={`spa-ratio-value spa-ratio-value--${axis}`}>{`${ratio}%`}</span>
                      <div className="spa-ratio-bar">
                        <span className={`spa-ratio-bar__fill spa-ratio-bar__fill--${axis}`} style={{ width: `${ratio}%` }} />
                      </div>
                    </td>
                    <td className="spa-num">
                      <div className="spa-quota-cell">
                        <input
                          className="spa-num-input"
                          type="text"
                          value={displayed}
                          data-testid="conditional-row-input"
                          onChange={(e) => {
                            const digits = e.currentTarget.value.replace(/[^0-9]/g, "");
                            setEditing((map) => ({ ...map, [rowId]: digits }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.stopPropagation();
                            commitRow(rowId, panel.quotas);
                          }}
                          onBlur={() => commitRow(rowId, panel.quotas)}
                        />
                      </div>
                    </td>
                    <td className="spa-action">
                      <button
                        type="button"
                        className="spa-row-delete"
                        aria-label="Delete row"
                        data-testid="conditional-row-delete"
                        onClick={() => deleteRow.call(rowId)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
