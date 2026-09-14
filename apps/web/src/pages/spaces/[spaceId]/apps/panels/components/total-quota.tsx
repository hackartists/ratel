import { useState } from "react";
import { usePanelsI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/panels/panels.i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { panelAttributes } from "../hooks/panel-logic";
import { useSpacePanels } from "../hooks/use-space-panels";

// panels/views/home/total_quota.rs — digits-only total quota input (saved on
// Enter / blur when changed) and the allocated / unassigned meter.
export function TotalQuota() {
  const tr = usePanelsI18n();
  const { space } = useSpaceAppsContext();
  const { panels, updateTotalQuota } = useSpacePanels();

  const currentQuota = space.quota;

  // Local text; re-hydrated when the server quota changes.
  const [inputValue, setInputValue] = useState(String(currentQuota));
  const [syncedQuota, setSyncedQuota] = useState(currentQuota);
  if (syncedQuota !== currentQuota) {
    setSyncedQuota(currentQuota);
    setInputValue(String(currentQuota));
  }

  const allocated = panels
    .filter((p) => panelAttributes(p).some((a) => a.type === "verifiable_attribute"))
    .reduce((sum, p) => sum + Math.max(p.quotas, 0), 0);
  const unassigned = Math.max(currentQuota - allocated, 0);
  const fillPct = currentQuota > 0 ? Math.min(Math.max((allocated / currentQuota) * 100, 0), 100) : 0;

  const commit = () => {
    const parsed = Number.parseInt(inputValue, 10);
    const next = Number.isNaN(parsed) ? 0 : parsed;
    if (next !== space.quota) updateTotalQuota.call(next);
  };

  return (
    <section className="spa-section" data-testid="section-total-quotas">
      <div className="spa-section__head">
        <div className="spa-section__title">
          <span className="spa-section__label">{tr.totalQuotas}</span>
        </div>
        <span className="spa-section__hint">{tr.totalQuotasHint}</span>
      </div>
      <div className="spa-quota-row">
        <span className="spa-quota-label">{tr.totalLabel}</span>
        <input
          className="spa-quota-input"
          type="text"
          value={inputValue}
          data-testid="total-quota-input"
          onChange={(e) => setInputValue(e.currentTarget.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.stopPropagation();
            commit();
          }}
          onBlur={commit}
        />
        <div className="spa-quota-meter">
          <div className="spa-quota-meter__bar">
            <div className="spa-quota-meter__fill" style={{ width: `${fillPct.toFixed(1)}%` }} />
          </div>
          <div className="spa-quota-meter__labels">
            <span>
              <strong>{allocated}</strong>
              {` ${tr.allocatedLabel}`}
            </span>
            <span>{`${unassigned} ${tr.unassignedLabel}`}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
