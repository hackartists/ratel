import { useNavigate } from "react-router-dom";
import type { SubjectResponse } from "@ratel/ts-bridges";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useFactFoldAdminScheduleI18n } from "./i18n";
import { useAdminLiteralsI18n } from "../../admin-literals.i18n";
import { useAdminSchedule } from "../hooks/use-admin-schedule";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/schedule/component.rs
// (`FactFoldAdminSchedulePage`, `/admin/fact-or-fold/schedule`): the queue
// alarm (or healthy) banner and the upcoming scheduled subjects.
export function Component() {
  const tr = useFactFoldAdminScheduleI18n();
  const lit = useAdminLiteralsI18n();
  const { rows, alarm } = useAdminSchedule();

  return (
    <>
      <SeoMeta title={lit.fill("ff_page_title", { page: tr.pageTitle })} />
      <section className="ff-schedule">
        {alarm.alert ? (
          <AlarmBanner
            daysRemaining={alarm.queue_days_remaining}
            alertThresholdDays={alarm.alert_threshold_days}
            scheduledCount={alarm.scheduled_future_count}
          />
        ) : (
          <HealthyBanner daysRemaining={alarm.queue_days_remaining} scheduledCount={alarm.scheduled_future_count} />
        )}

        <div className="ff-schedule__panel">
          <header className="ff-schedule__panel-head">
            <span className="ff-schedule__panel-title">{tr.upcomingTitle}</span>
            <span className="ff-schedule__panel-sub">{`${rows.length} ${tr.upcomingCountSuffix}`}</span>
          </header>
          {rows.length === 0 ? (
            <div className="ff-schedule__empty">{tr.empty}</div>
          ) : (
            <ul className="ff-schedule__list">
              {rows.map((row) => (
                <ScheduleRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function AlarmBanner({
  daysRemaining,
  alertThresholdDays,
  scheduledCount,
}: {
  daysRemaining: number;
  alertThresholdDays: number;
  scheduledCount: number;
}) {
  const tr = useFactFoldAdminScheduleI18n();
  const navigate = useNavigate();
  const days = daysRemaining.toFixed(1);
  return (
    <div className="ff-schedule__banner ff-schedule__banner--alert">
      <div className="ff-schedule__banner-icon">⚠</div>
      <div className="ff-schedule__banner-text">
        <strong>{tr.alarmTitle}</strong>
        <p>
          {`${tr.alarmBodyPrefix} `}
          <strong>{`${days} ${tr.alarmBodyDaysUnit}`}</strong>
          {` (${scheduledCount} ${tr.alarmBodyCountSuffix}). `}
          {`${tr.alarmThresholdPrefix} ${alertThresholdDays}${tr.alarmThresholdSuffix}`}
        </p>
      </div>
      <button className="ff-schedule__banner-cta" onClick={() => navigate("/admin/fact-or-fold/subjects/new")}>
        {`+ ${tr.alarmCta}`}
      </button>
    </div>
  );
}

function HealthyBanner({ daysRemaining, scheduledCount }: { daysRemaining: number; scheduledCount: number }) {
  const tr = useFactFoldAdminScheduleI18n();
  const days = daysRemaining.toFixed(1);
  return (
    <div className="ff-schedule__banner ff-schedule__banner--ok">
      <div className="ff-schedule__banner-icon">✓</div>
      <div className="ff-schedule__banner-text">
        <strong>{tr.healthyTitle}</strong>
        <p>{`${scheduledCount} ${tr.healthyCountSuffix} · ${days} ${tr.healthyDaysSuffix}`}</p>
      </div>
    </div>
  );
}

function ScheduleRow({ row }: { row: SubjectResponse }) {
  const scheduledLabel = row.scheduled_at !== null ? `ts:${row.scheduled_at}` : "—";
  return (
    <li className="ff-schedule__row">
      <div className="ff-schedule__when">{scheduledLabel}</div>
      <div className="ff-schedule__what">
        <div className="ff-schedule__row-title">{row.headline_text}</div>
        <div className="ff-schedule__row-meta">
          <span className="ff-schedule__row-source">{row.source_label}</span>
          {row.category_tags.length > 0 && (
            <>
              <span className="ff-schedule__row-sep">·</span>
              {row.category_tags.map((tag, index) => (
                <span key={index} className="ff-schedule__row-tag">
                  {tag}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
