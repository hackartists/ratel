import { useState } from "react";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { ActionDependencySelector } from "@/components/space-actions/action-dependency-selector";
import { ActionRewardSetting } from "@/components/space-actions/action-reward-setting";
import { ActionStatusControl } from "@/components/space-actions/action-status-control";
import { ActionDeleteButton } from "@/components/space-actions/delete-action";
import { PrerequisiteTile } from "@/components/space-actions/prerequisite-tile";
import { Button } from "@/components/ui/button";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useMeetActionI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/meet/components/meet_page/meet-action.i18n";
import { useToast } from "@/lib/toast";
import { useMeet } from "../hooks/use-meet";

// meet/components/meet_page/{editor_view,mode_toggle,details_card,when_card,config_card,submit_bar}.rs

export function MeetEditorView() {
  const tr = useMeetActionI18n();
  return (
    <>
      <SeoMeta title={tr.pageTitle} />
      <div className="meet-editor" data-testid="meet-editor-view">
        <MeetModeToggle />
        <MeetDetailsCard />
        <MeetWhenCard />
        <MeetConfigCard />
        <MeetSubmitBar />
      </div>
    </>
  );
}

function MeetModeToggle() {
  const tr = useMeetActionI18n();
  const { meet, updateMode } = useMeet();
  const current = meet.mode;

  return (
    <section className="meet-card">
      <header className="meet-card__head">
        <h2 className="meet-card__title meet-card__title--meet">{tr.modeLabel}</h2>
      </header>
      <div className="mode-toggle" role="tablist" data-testid="meet-mode-toggle">
        <div
          className="mode-option"
          role="tab"
          aria-selected={current === "Scheduled" ? "true" : "false"}
          data-testid="meet-mode-scheduled"
          onClick={() => updateMode("Scheduled")}
        >
          <span className="mode-option__title">{tr.modeScheduled}</span>
          <p className="mode-option__desc">{tr.modeScheduledDesc}</p>
        </div>
        <div
          className="mode-option"
          role="tab"
          aria-selected={current === "Instant" ? "true" : "false"}
          data-testid="meet-mode-instant"
          onClick={() => updateMode("Instant")}
        >
          <span className="mode-option__title">{tr.modeInstant}</span>
          <p className="mode-option__desc">{tr.modeInstantDesc}</p>
        </div>
      </div>
    </section>
  );
}

function MeetDetailsCard() {
  const tr = useMeetActionI18n();
  const toast = useToast();
  const { spaceId, meetId, meet } = useMeet();
  const update = useUpdateSpaceAction();
  const [title, setTitle] = useState(meet.space_action.title);
  const [desc, setDesc] = useState(meet.space_action.description);

  return (
    <section className="meet-card">
      <header className="meet-card__head">
        <h2 className="meet-card__title meet-card__title--meet">{tr.detailsLabel}</h2>
      </header>
      <div className="field">
        <label className="field__label">{tr.detailsTitleLabel}</label>
        <input
          className="field__input"
          data-testid="meet-title-input"
          placeholder={tr.detailsTitlePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() =>
            update.mutateAsync({ spaceId, actionId: meetId, req: { title } }).catch((e) => toast.error(e))
          }
        />
      </div>
      <div className="field">
        <label className="field__label">{tr.detailsDescriptionLabel}</label>
        <textarea
          className="field__textarea"
          data-testid="meet-description-input"
          placeholder={tr.detailsDescriptionPlaceholder}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() =>
            update.mutateAsync({ spaceId, actionId: meetId, req: { description: desc } }).catch((e) => toast.error(e))
          }
        />
      </div>
    </section>
  );
}

/** `format_datetime_local` — UTC `%Y-%m-%dT%H:%M`. */
function formatDatetimeLocal(tsMs: number): string {
  const d = new Date(tsMs);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

/** `parse_datetime_local` — the value is read as UTC. */
function parseDatetimeLocal(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const ms = Date.parse(`${s}:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

function MeetWhenCard() {
  const tr = useMeetActionI18n();
  const { meet, updateStartTime, updateDuration } = useMeet();
  const startValue = formatDatetimeLocal(meet.start_time);
  const duration = meet.duration_min;
  const startDisabled = meet.mode === "Instant";

  return (
    <section className="meet-card">
      <header className="meet-card__head">
        <h2 className="meet-card__title meet-card__title--meet">{tr.whenLabel}</h2>
      </header>
      <div className="when-row">
        <div className="field">
          <label className="field__label">{tr.whenStartLabel}</label>
          <input
            className="field__input"
            type="datetime-local"
            data-testid="meet-start-time"
            disabled={startDisabled}
            // Uncontrolled like the Rust `value` attribute: it follows the
            // saved start time, and `change` fires on commit.
            key={startValue}
            defaultValue={startValue}
            onChange={(e) => {
              const ts = parseDatetimeLocal(e.target.value);
              if (ts !== null) updateStartTime(ts);
            }}
          />
        </div>
        <div className="field">
          <label className="field__label">{tr.whenDurationLabel}</label>
          <div className="dur">
            <button
              className="dur__step"
              data-testid="meet-duration-dec"
              onClick={() => updateDuration(Math.max(duration - 15, 15))}
            >
              −
            </button>
            <span className="dur__value" data-testid="meet-duration-value">
              {duration}
              <small>{` ${tr.whenDurationUnitMin}`}</small>
            </span>
            <button
              className="dur__step"
              data-testid="meet-duration-inc"
              onClick={() => updateDuration(Math.min(duration + 15, 1440))}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MeetConfigCard() {
  const tr = useMeetActionI18n();
  const { spaceId, meetId, meet } = useMeet();
  const [action] = useState(meet.space_action);

  return (
    <section className="meet-card">
      <header className="meet-card__head">
        <h2 className="meet-card__title meet-card__title--meet">{tr.settingsLabel}</h2>
      </header>

      <ActionDependencySelector spaceId={spaceId} actionId={meetId} initialDependsOn={action.depends_on} />

      <ActionRewardSetting
        spaceId={spaceId}
        actionId={meetId}
        savedCredits={action.credits}
        actionStatus={action.status}
      />

      <PrerequisiteTile spaceId={spaceId} actionId={meetId} initialPrerequisite={action.prerequisite} />

      <ActionStatusControl spaceId={spaceId} actionId={meetId} initialStatus={action.status} />

      <ActionDeleteButton spaceId={spaceId} actionId={meetId} />
    </section>
  );
}

function MeetSubmitBar() {
  const tr = useMeetActionI18n();
  const { meet, publish } = useMeet();
  const status = meet.space_action.status ?? "Designing";
  const isPublished = status !== "Designing";
  const label = meet.mode === "Instant" ? tr.submitStartNow : tr.submitSchedule;

  return (
    <div className="create-bar">
      <Button data-testid="meet-submit-button" disabled={isPublished} onClick={() => publish()}>
        {label}
      </Button>
    </div>
  );
}
