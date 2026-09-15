import { useState } from "react";
import type { SubjectResponse, SubjectStatus, Verdict } from "@ratel/ts-bridges";
import { useFactFoldAdminSubjectsI18n } from "@/pages/admin/fact-or-fold/subjects/i18n";
import { useAdminLiteralsI18n } from "../../../admin-literals.i18n";
import { displayError } from "../../../hooks/format";
import type { AdminSubjectActions } from "../../hooks/use-admin-subjects";

// `SubjectsTable` / `SubjectRow` / `VerdictBadge` / `StatusBadge` of
// fact_or_fold/pages/admin/subjects/component.rs.

export function SubjectsTable({ rows, actions }: { rows: SubjectResponse[]; actions: AdminSubjectActions }) {
  const tr = useFactFoldAdminSubjectsI18n();
  return (
    <table className="ff-subjects__table">
      <thead>
        <tr>
          <th>{tr.colId}</th>
          <th>{tr.colSubject}</th>
          <th>{tr.colVerdict}</th>
          <th>{tr.colTags}</th>
          <th>{tr.colScheduled}</th>
          <th>{tr.colExpires}</th>
          <th>{tr.colStatus}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <SubjectRow key={row.id} row={row} actions={actions} />
        ))}
      </tbody>
    </table>
  );
}

/** `format_millis_short` — a millis fallback label until chrono is wired. */
function formatMillisShort(millis: number): string {
  return `ts:${millis}`;
}

function SubjectRow({ row, actions }: { row: SubjectResponse; actions: AdminSubjectActions }) {
  const tr = useFactFoldAdminSubjectsI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: (id: string) => Promise<unknown>) => {
    setBusy(true);
    try {
      await action(row.id);
    } catch (e) {
      setError(displayError(e));
    }
    setBusy(false);
  };

  const scheduledLabel = row.scheduled_at !== null ? formatMillisShort(row.scheduled_at) : "—";
  // `format_expires_at`: 0 = no expiry, past = expired, future = millis label.
  const expiresLabel =
    row.expires_at <= 0 ? tr.expiresNone : row.expires_at <= Date.now() ? tr.expiresExpired : formatMillisShort(row.expires_at);

  const canPublishNow = row.status === "Draft" || row.status === "Scheduled";
  const canDelete = !(row.status === "Live" || row.status === "Settled");

  return (
    <tr className="ff-subjects__row" data-testid={`ff-admin-row-${row.id}`}>
      <td className="ff-subjects__cell-mono">{Array.from(row.id).slice(0, 8).join("")}</td>
      <td>
        <div className="ff-subjects__subject-text">{row.headline_text}</div>
        {error !== null && <div className="ff-subjects__row-error">{error}</div>}
      </td>
      <td>
        <VerdictBadge verdict={row.verdict} />
      </td>
      <td>
        <div className="ff-subjects__tags">
          {row.category_tags.map((tag, index) => (
            <span key={index} className="ff-subjects__pill">
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="ff-subjects__cell-muted">{scheduledLabel}</td>
      <td className="ff-subjects__cell-muted">{expiresLabel}</td>
      <td>
        <StatusBadge status={row.status} />
      </td>
      <td className="ff-subjects__row-actions">
        {canPublishNow && (
          <button
            className="ff-subjects__icon-btn"
            data-testid={`ff-admin-row-publish-${row.id}`}
            title={tr.actionPublish}
            disabled={busy}
            onClick={() => void run(actions.publishNow)}
          >
            ▶
          </button>
        )}
        {canDelete && (
          <button
            className="ff-subjects__icon-btn ff-subjects__icon-btn--danger"
            data-testid={`ff-admin-row-delete-${row.id}`}
            title={tr.actionDelete}
            disabled={busy}
            onClick={() => void run(actions.remove)}
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const lit = useAdminLiteralsI18n();
  const fake = verdict === "FAKE";
  return (
    <span className="ff-subjects__verdict" data-variant={fake ? "fake" : "real"}>
      {fake ? lit.text("ff_verdict_fake") : lit.text("ff_verdict_real")}
    </span>
  );
}

const STATUS_BADGE = {
  Draft: ["draft", "ff_status_draft"],
  Scheduled: ["scheduled", "ff_status_scheduled"],
  Live: ["live", "ff_status_live"],
  Settled: ["settled", "ff_status_settled"],
  Deleted: ["deleted", "ff_status_deleted"],
} as const satisfies Record<SubjectStatus, readonly [string, string]>;

function StatusBadge({ status }: { status: SubjectStatus }) {
  const lit = useAdminLiteralsI18n();
  const [variant, label] = STATUS_BADGE[status];
  return (
    <span className="ff-subjects__status" data-variant={variant}>
      {lit.text(label)}
    </span>
  );
}
