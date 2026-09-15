import { useState, type ReactNode } from "react";
import type { FactOrFoldSettingsResponse, UpdateFactOrFoldSettingsRequest } from "@ratel/ts-bridges";
import { useFactFoldAdminSettingsI18n } from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/admin/settings/fact-fold-admin-settings.i18n";
import { displayError, parseF64, parseI32, parseI64, roundToI32 } from "../../../hooks/format";
import { useDioxusInput } from "../../../hooks/use-dioxus-input";

// `SettingsForm`, `SettingsSection`, `IntRow`, `BigIntRow` and `BpsRow` of
// fact_or_fold/pages/admin/settings/component.rs. One state per field, seeded
// once from `initial`.

type Settings = FactOrFoldSettingsResponse;

export function SettingsForm({
  initial,
  save,
}: {
  initial: Settings;
  save: (patch: UpdateFactOrFoldSettingsRequest) => Promise<Settings>;
}) {
  const tr = useFactFoldAdminSettingsI18n();
  const [values, setValues] = useState<Settings>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const field =
    <K extends keyof Settings>(key: K) =>
    (value: Settings[K]) =>
      setValues((v) => ({ ...v, [key]: value }));

  const onSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Every field is sent, like the Rust patch of `Some(..)`s.
      await save({ ...values });
      setSavedAt(Date.now());
    } catch (e) {
      setError(displayError(e));
    }
    setSubmitting(false);
  };

  return (
    <form className="ff-settings" onSubmit={(e) => e.preventDefault()}>
      <SettingsSection title={tr.sectionRoundTitle} sub={tr.sectionRoundSub}>
        <IntRow
          label={tr.roundCapacity}
          desc={tr.roundCapacityDesc}
          suffix={tr.unitPeople}
          value={values.round_capacity}
          onChange={field("round_capacity")}
        />
        {values.round_capacity === 1 && (
          <p className="ff-settings__warning" data-testid="ff-admin-settings-solo-warning">
            {tr.roundCapacitySoloWarning}
          </p>
        )}
        <IntRow
          label={tr.stageNewsRevealSec}
          desc={tr.stageSecDesc}
          suffix={tr.unitSec}
          value={values.stage_news_reveal_sec}
          onChange={field("stage_news_reveal_sec")}
        />
        <IntRow
          label={tr.stageBetSec}
          desc={tr.stageSecDesc}
          suffix={tr.unitSec}
          value={values.stage_bet_sec}
          onChange={field("stage_bet_sec")}
        />
        <IntRow
          label={tr.stageRationaleSec}
          desc={tr.stageSecDesc}
          suffix={tr.unitSec}
          value={values.stage_rationale_sec}
          onChange={field("stage_rationale_sec")}
        />
        <IntRow
          label={tr.stageRevealSec}
          desc={tr.stageSecDesc}
          suffix={tr.unitSec}
          value={values.stage_reveal_sec}
          onChange={field("stage_reveal_sec")}
        />
        <IntRow
          label={tr.stageDebateSec}
          desc={tr.stageSecDesc}
          suffix={tr.unitSec}
          value={values.stage_debate_sec}
          onChange={field("stage_debate_sec")}
        />
      </SettingsSection>

      <SettingsSection title={tr.sectionEconomyTitle} sub={tr.sectionEconomySub}>
        <BigIntRow
          label={tr.minBetRp}
          desc={tr.minBetRpDesc}
          suffix={tr.unitRp}
          value={values.min_bet_rp}
          onChange={field("min_bet_rp")}
        />
        <BigIntRow
          label={tr.maxBetRp}
          desc={tr.maxBetRpDesc}
          suffix={tr.unitRp}
          value={values.max_bet_rp}
          onChange={field("max_bet_rp")}
        />
        <BpsRow
          label={tr.correctMultiplier}
          desc={tr.correctMultiplierDesc}
          value={values.correct_side_multiplier_bps}
          onChange={field("correct_side_multiplier_bps")}
        />
        <BpsRow
          label={tr.insiderBonus}
          desc={tr.insiderBonusDesc}
          value={values.insider_correct_bonus_bps}
          onChange={field("insider_correct_bonus_bps")}
        />
        <BpsRow
          label={tr.influenceBonus}
          desc={tr.influenceBonusDesc}
          value={values.influence_bonus_bps}
          onChange={field("influence_bonus_bps")}
        />
        <BigIntRow
          label={tr.signupRp}
          desc={tr.signupRpDesc}
          suffix={tr.unitRp}
          value={values.new_user_signup_rp}
          onChange={field("new_user_signup_rp")}
        />
      </SettingsSection>

      <SettingsSection title={tr.sectionInsiderTitle} sub={tr.sectionInsiderSub}>
        <p className="ff-settings__note">{tr.insiderNote}</p>
      </SettingsSection>

      <SettingsSection title={tr.sectionOpsTitle} sub={tr.sectionOpsSub}>
        <IntRow
          label={tr.reconnectGrace}
          desc={tr.reconnectGraceDesc}
          suffix={tr.unitSec}
          value={values.reconnect_grace_sec}
          onChange={field("reconnect_grace_sec")}
        />
        <IntRow
          label={tr.queueAlert}
          desc={tr.queueAlertDesc}
          suffix={tr.unitDay}
          value={values.queue_low_alert_days}
          onChange={field("queue_low_alert_days")}
          testid="ff-admin-settings-queue-low"
        />
      </SettingsSection>

      <div className="ff-settings__deferred">
        <strong>{tr.deferredTitle}</strong>
        <ul>
          <li>{tr.deferredAutoPublish}</li>
          <li>{tr.deferredAutoBackfill}</li>
          <li>{tr.deferredEssencePolicy}</li>
          <li>{tr.deferredDangerZone}</li>
        </ul>
      </div>

      <div className="ff-settings__actions">
        {error !== null && <span className="ff-settings__error">{error}</span>}
        {savedAt !== null && error === null && <span className="ff-settings__saved">{tr.saved}</span>}
        <button
          className="btn btn--primary"
          data-testid="ff-admin-settings-save"
          disabled={submitting}
          onClick={() => void onSave()}
        >
          {submitting ? tr.saving : tr.save}
        </button>
      </div>
    </form>
  );
}

function SettingsSection({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="ff-settings__section">
      <header className="ff-settings__section-head">
        <span className="ff-settings__section-title">{title}</span>
        <span className="ff-settings__section-sub">{sub}</span>
      </header>
      <div className="ff-settings__panel">{children}</div>
    </section>
  );
}

interface RowProps {
  label: string;
  desc: string;
  value: number;
  onChange: (value: number) => void;
}

function RowText({ label, desc }: Pick<RowProps, "label" | "desc">) {
  return (
    <div className="ff-settings__row-text">
      <div className="ff-settings__label">{label}</div>
      <div className="ff-settings__desc">{desc}</div>
    </div>
  );
}

/** `IntRow` — i32; `data-testid` is always rendered (empty by default). */
function IntRow({ label, desc, suffix, value, onChange, testid = "" }: RowProps & { suffix: string; testid?: string }) {
  const input = useDioxusInput<HTMLInputElement>(String(value));
  return (
    <div className="ff-settings__row">
      <RowText label={label} desc={desc} />
      <div className="ff-settings__control">
        <input
          className="ff-settings__input"
          data-testid={testid}
          type="number"
          {...input}
          onInput={(e) => {
            const parsed = parseI32(e.currentTarget.value);
            if (parsed !== null) onChange(parsed);
          }}
        />
        <span className="ff-settings__suffix">{suffix}</span>
      </div>
    </div>
  );
}

/** `BigIntRow` — i64. */
function BigIntRow({ label, desc, suffix, value, onChange }: RowProps & { suffix: string }) {
  const input = useDioxusInput<HTMLInputElement>(String(value));
  return (
    <div className="ff-settings__row">
      <RowText label={label} desc={desc} />
      <div className="ff-settings__control">
        <input
          className="ff-settings__input"
          type="number"
          {...input}
          onInput={(e) => {
            const parsed = parseI64(e.currentTarget.value);
            if (parsed !== null) onChange(parsed);
          }}
        />
        <span className="ff-settings__suffix">{suffix}</span>
      </div>
    </div>
  );
}

/** `BpsRow` — shows the "1.60" multiplier, stores basis points (10000 = 1.0×). */
function BpsRow({ label, desc, value, onChange }: RowProps) {
  const input = useDioxusInput<HTMLInputElement>((value / 10_000).toFixed(2));
  return (
    <div className="ff-settings__row">
      <RowText label={label} desc={desc} />
      <div className="ff-settings__control">
        <input
          className="ff-settings__input"
          type="number"
          step="0.01"
          {...input}
          onInput={(e) => {
            const parsed = parseF64(e.currentTarget.value);
            if (parsed !== null) onChange(roundToI32(parsed * 10_000));
          }}
        />
        <span className="ff-settings__suffix">×</span>
      </div>
    </div>
  );
}
