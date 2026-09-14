import { useState } from "react";
import type { RewardCondition, RewardPeriod, RewardResponse, RewardUserBehavior } from "@ratel/ts-bridges";
import { useAdminRewardsI18n } from "@/i18n/generated/features/admin/views/main/admin-rewards.i18n";
import { useAdminLiteralsI18n, type AdminLiteralsI18n } from "../admin-literals.i18n";
import { formatWithCommas, parseI64 } from "../hooks/format";
import { useRewards } from "../hooks/use-admin-main";
import { useDioxusInput } from "../hooks/use-dioxus-input";

// Reward management section of `AdminMainPage` (admin/views/main/mod.rs) with
// the create / edit modal, plus the labels of admin/models/reward_types.rs.

type LiteralKey = Parameters<AdminLiteralsI18n["text"]>[0];

/** `RewardUserBehavior::all()`; `value` is the enum's Display (DynamoEnum UPPER_SNAKE). */
const BEHAVIORS: ReadonlyArray<{ value: RewardUserBehavior; label: LiteralKey }> = [
  { value: "RESPOND_POLL", label: "behavior_respond_poll" },
  { value: "DISCUSSION_COMMENT", label: "behavior_discussion_comment" },
  { value: "QUIZ_ANSWER", label: "behavior_quiz_answer" },
  { value: "FOLLOW", label: "behavior_follow" },
  { value: "ATTEND_MEET", label: "behavior_attend_meet" },
];

/** `RewardPeriod::all()`; `value` is the Display, `period` the serde name sent to the server. */
const PERIODS: ReadonlyArray<{ period: RewardPeriod; value: string; label: LiteralKey }> = [
  { period: "Once", value: "ONCE", label: "period_once" },
  { period: "Hourly", value: "HOURLY", label: "period_hourly" },
  { period: "Daily", value: "DAILY", label: "period_daily" },
  { period: "Weekly", value: "WEEKLY", label: "period_weekly" },
  { period: "Monthly", value: "MONTHLY", label: "period_monthly" },
  { period: "Yearly", value: "YEARLY", label: "period_yearly" },
  { period: "Unlimited", value: "UNLIMITED", label: "period_unlimited" },
];

/** `ConditionType` (admin/models/reward_types.rs). */
type ConditionType = "None" | "MaxClaims" | "MaxPoints" | "MaxUserClaims" | "MaxUserPoints";

const CONDITION_OPTIONS: ReadonlyArray<{ value: ConditionType; label: LiteralKey }> = [
  { value: "None", label: "condition_none" },
  { value: "MaxClaims", label: "condition_max_claims" },
  { value: "MaxPoints", label: "condition_max_points" },
  { value: "MaxUserClaims", label: "condition_max_user_claims" },
  { value: "MaxUserPoints", label: "condition_max_user_points" },
];

const CONDITION_VALUE_LABEL: Record<Exclude<ConditionType, "None">, LiteralKey> = {
  MaxClaims: "condition_max_claims_value",
  MaxPoints: "condition_max_points_value",
  MaxUserClaims: "condition_max_user_claims_value",
  MaxUserPoints: "condition_max_user_points_value",
};

/** DynamoEnum `FromStr` accepts every casing of a variant name. */
const normalize = (value: string) => value.replace(/[_-]/g, "").toLowerCase();

function behaviorOf(value: string) {
  return BEHAVIORS.find((b) => normalize(b.value) === normalize(value));
}

function periodOf(value: string) {
  return PERIODS.find((p) => normalize(p.value) === normalize(value));
}

function conditionParts(condition: RewardCondition): [ConditionType, number | null] {
  if (condition === "None") return ["None", null];
  const [type, value] = Object.entries(condition)[0] as [Exclude<ConditionType, "None">, number];
  return [type, value];
}

/** `RewardCondition::from_type_and_value`. */
function conditionFrom(type: ConditionType, value: number): RewardCondition {
  switch (type) {
    case "None":
      return "None";
    case "MaxClaims":
      return { MaxClaims: value };
    case "MaxPoints":
      return { MaxPoints: value };
    case "MaxUserClaims":
      return { MaxUserClaims: value };
    case "MaxUserPoints":
      return { MaxUserPoints: value };
  }
}

/** `RewardConditionExt::label`. */
function conditionLabel(condition: RewardCondition, lit: AdminLiteralsI18n): string {
  const [type, value] = conditionParts(condition);
  if (type === "None") return lit.text("condition_none");
  return lit.fill(CONDITION_VALUE_LABEL[type], { value: value ?? 0 });
}

interface FormState {
  behavior: RewardUserBehavior;
  point: number;
  period: RewardPeriod;
  conditionType: ConditionType;
  conditionValue: number;
}

const DEFAULT_FORM: FormState = {
  behavior: BEHAVIORS[0].value,
  point: 0,
  period: "Once",
  conditionType: "None",
  conditionValue: 0,
};

export function RewardSection() {
  const tr = useAdminRewardsI18n();
  const lit = useAdminLiteralsI18n();
  const { rewards, save } = useRewards();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RewardResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const openCreateForm = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEditForm = (reward: RewardResponse) => {
    const [conditionType, conditionValue] = conditionParts(reward.condition);
    setForm({
      behavior: behaviorOf(reward.reward_behavior)?.value ?? reward.reward_behavior,
      point: reward.point,
      period: reward.period,
      conditionType,
      conditionValue: conditionValue ?? 0,
    });
    setEditing(reward);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const onSubmit = async () => {
    const isEdit = editing !== null;
    const req = {
      behavior: form.behavior,
      point: form.point,
      period: form.period,
      condition: conditionFrom(form.conditionType, form.conditionValue),
    };
    setIsSubmitting(true);
    try {
      await save(isEdit, req);
      setIsSubmitting(false);
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      setIsSubmitting(false);
      console.error("Failed to save reward:", e);
    }
  };

  return (
    <section className="admin-arena__section">
      <div className="admin-arena__section-actions">
        <span className="admin-arena__section-actions-title">{tr.title}</span>
        <button className="admin-arena__btn" type="button" onClick={openCreateForm}>
          {tr.addReward}
        </button>
      </div>

      {showForm && (
        <RewardFormModal
          isEditing={editing !== null}
          isSubmitting={isSubmitting}
          form={form}
          setForm={setForm}
          onClose={closeForm}
          onSubmit={() => void onSubmit()}
        />
      )}

      <div className="admin-arena__table-wrap">
        <div className="admin-arena__table-head">{tr.tabRules}</div>
        {rewards.length === 0 ? (
          <div className="admin-arena__table-empty">{tr.noRewards}</div>
        ) : (
          <table className="admin-arena__table">
            <thead>
              <tr>
                <th>{tr.actionLabel}</th>
                <th>{tr.point}</th>
                <th>{tr.period}</th>
                <th>{tr.condition}</th>
                <th>{tr.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((reward, index) => {
                const behavior = behaviorOf(reward.reward_behavior);
                const period = periodOf(reward.period);
                return (
                  <tr key={index}>
                    <td>{behavior ? lit.text(behavior.label) : reward.reward_behavior}</td>
                    <td>{formatWithCommas(reward.point)}</td>
                    <td>{period ? lit.text(period.label) : reward.period}</td>
                    <td>{conditionLabel(reward.condition, lit)}</td>
                    <td>
                      <button className="admin-arena__table-link" onClick={() => openEditForm(reward)}>
                        {tr.edit}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

interface RewardFormModalProps {
  isEditing: boolean;
  isSubmitting: boolean;
  form: FormState;
  setForm: (update: (form: FormState) => FormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function RewardFormModal({ isEditing, isSubmitting, form, setForm, onClose, onSubmit }: RewardFormModalProps) {
  const tr = useAdminRewardsI18n();
  const lit = useAdminLiteralsI18n();
  const pointInput = useDioxusInput<HTMLInputElement>(String(form.point), (value) => {
    const point = parseI64(value);
    if (point !== null) setForm((f) => ({ ...f, point }));
  });

  return (
    <div className="admin-arena__modal-overlay" onClick={onClose}>
      <div className="admin-arena__modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="admin-arena__modal-title">{isEditing ? tr.editReward : tr.addReward}</h2>

        <div className="mb-4 admin-arena__form admin-arena__form--stretch">
          <label className="admin-arena__form-label">{tr.actionLabel}</label>
          <select
            className="admin-arena__form-select"
            disabled={isEditing}
            value={form.behavior}
            onChange={(e) => {
              const behavior = behaviorOf(e.target.value);
              if (behavior) setForm((f) => ({ ...f, behavior: behavior.value }));
            }}
          >
            {BEHAVIORS.map((behavior) => (
              <option key={behavior.value} value={behavior.value}>
                {lit.text(behavior.label)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 admin-arena__form admin-arena__form--stretch">
          <label className="admin-arena__form-label">{tr.point}</label>
          <input type="number" className="admin-arena__form-input" {...pointInput} />
        </div>

        <div className="mb-4 admin-arena__form admin-arena__form--stretch">
          <label className="admin-arena__form-label">{tr.period}</label>
          <select
            className="admin-arena__form-select"
            value={periodOf(form.period)?.value}
            onChange={(e) => {
              const period = periodOf(e.target.value);
              if (period) setForm((f) => ({ ...f, period: period.period }));
            }}
          >
            {PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {lit.text(period.label)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 admin-arena__form admin-arena__form--stretch">
          <label className="admin-arena__form-label">{tr.condition}</label>
          <select
            className="admin-arena__form-select"
            value={form.conditionType}
            onChange={(e) => {
              const option = CONDITION_OPTIONS.find((o) => o.value === e.target.value);
              const conditionType = option ? option.value : "None";
              setForm((f) => ({ ...f, conditionType }));
            }}
          >
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {lit.text(option.label)}
              </option>
            ))}
          </select>
        </div>

        {form.conditionType !== "None" && <ConditionValueField form={form} setForm={setForm} />}

        <div className="admin-arena__modal-actions">
          <button className="admin-arena__btn admin-arena__btn--ghost" onClick={onClose}>
            {tr.cancel}
          </button>
          <button className="admin-arena__btn" disabled={isSubmitting} onClick={onSubmit}>
            {tr.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConditionValueField({ form, setForm }: Pick<RewardFormModalProps, "form" | "setForm">) {
  const tr = useAdminRewardsI18n();
  const valueInput = useDioxusInput<HTMLInputElement>(String(form.conditionValue), (value) => {
    const conditionValue = parseI64(value);
    if (conditionValue !== null) setForm((f) => ({ ...f, conditionValue }));
  });
  return (
    <div className="mb-4 admin-arena__form admin-arena__form--stretch">
      <label className="admin-arena__form-label">{tr.conditionValue}</label>
      <input type="number" className="admin-arena__form-input" {...valueInput} />
    </div>
  );
}
