import { SeoMeta } from "@/components/ui/seo-meta";
import { useFactFoldAdminReportsI18n } from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/admin/reports/fact-fold-admin-reports.i18n";
import { dataBool } from "@/lib/dom";
import { useAdminLiteralsI18n } from "../../admin-literals.i18n";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/reports/component.rs
// (`FactFoldAdminReportsPage`, `/admin/fact-or-fold/reports`): the moderation
// queue shell — disabled filter tabs and the empty state.
export function Component() {
  const tr = useFactFoldAdminReportsI18n();
  const lit = useAdminLiteralsI18n();
  return (
    <>
      <SeoMeta title={lit.fill("ff_page_title", { page: tr.pageTitle })} />
      <section className="ff-reports">
        <div className="ff-reports__notice">
          <strong>{tr.noticeTitle}</strong>
          <p>{tr.noticeBody}</p>
        </div>

        <div className="ff-reports__tabs">
          <ReportTab label={tr.tabOpen} active />
          <ReportTab label={tr.tabResolved} active={false} />
          <ReportTab label={tr.tabDismissed} active={false} />
        </div>

        <div className="ff-reports__panel">
          <div className="ff-reports__empty">{tr.empty}</div>
        </div>
      </section>
    </>
  );
}

function ReportTab({ label, active }: { label: string; active: boolean }) {
  return (
    <button type="button" className="ff-reports__tab" aria-selected={dataBool(active)} disabled>
      {label}
    </button>
  );
}
