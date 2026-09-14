import { useState, useTransition } from "react";
import type { SubjectStatus } from "@ratel/ts-bridges";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useFactFoldAdminSubjectsI18n } from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/admin/subjects/fact-fold-admin-subjects.i18n";
import { dataBool } from "@/lib/dom";
import { useAdminLiteralsI18n } from "../../admin-literals.i18n";
import { useAdminSubjects, useSubjectList } from "../hooks/use-admin-subjects";
import { SubjectsTable } from "./components/subjects-table";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/subjects/component.rs
// (`FactFoldAdminSubjectsPage`, `/admin/fact-or-fold/subjects`): KPI strip,
// status filter tabs and the subject table. Counts are over the currently
// filtered rows, as in Rust.
export function Component() {
  const tr = useFactFoldAdminSubjectsI18n();
  const lit = useAdminLiteralsI18n();
  const actions = useAdminSubjects();
  const [statusFilter, setStatusFilter] = useState<SubjectStatus | null>(null);
  // Keep the current table on screen while another filter loads (the Rust
  // loader keeps its last value instead of suspending again).
  const [, startTransition] = useTransition();
  const rows = useSubjectList(statusFilter);

  const count = (status: SubjectStatus) => rows.filter((row) => row.status === status).length;
  const total = rows.length;
  const countLive = count("Live");
  const countScheduled = count("Scheduled");
  const countDraft = count("Draft");
  const countSettled = count("Settled");

  const select = (status: SubjectStatus | null) => startTransition(() => setStatusFilter(status));

  return (
    <>
      <SeoMeta title={lit.fill("ff_page_title", { page: tr.pageTitle })} />
      <section className="ff-subjects">
        <div className="ff-subjects__kpi">
          <KpiTile label={tr.kpiTotal} value={String(total)} />
          <KpiTile label={tr.kpiLive} value={String(countLive)} accent="pink" />
          <KpiTile label={tr.kpiScheduled} value={String(countScheduled)} accent="gold" />
          <KpiTile label={tr.kpiDraft} value={String(countDraft)} accent="teal" />
        </div>

        <div className="ff-subjects__tabs">
          <FilterTab label={tr.tabAll} count={total} active={statusFilter === null} onClick={() => select(null)} />
          <FilterTab
            label={tr.tabLive}
            count={countLive}
            active={statusFilter === "Live"}
            onClick={() => select("Live")}
          />
          <FilterTab
            label={tr.tabScheduled}
            count={countScheduled}
            active={statusFilter === "Scheduled"}
            onClick={() => select("Scheduled")}
          />
          <FilterTab
            label={tr.tabDraft}
            count={countDraft}
            active={statusFilter === "Draft"}
            onClick={() => select("Draft")}
          />
          <FilterTab
            label={tr.tabSettled}
            count={countSettled}
            active={statusFilter === "Settled"}
            onClick={() => select("Settled")}
          />
        </div>

        <div className="ff-subjects__panel">
          {rows.length === 0 ? (
            <div className="ff-subjects__empty">{tr.empty}</div>
          ) : (
            <SubjectsTable rows={rows} actions={actions} />
          )}
        </div>
      </section>
    </>
  );
}

function KpiTile({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="ff-subjects__kpi-tile">
      <div className="ff-subjects__kpi-label">{label}</div>
      <div className="ff-subjects__kpi-value" data-accent={accent}>
        {value}
      </div>
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className="ff-subjects__tab" aria-selected={dataBool(active)} onClick={onClick}>
      <span>{label}</span>
      <span className="ff-subjects__tab-count">{count}</span>
    </button>
  );
}
