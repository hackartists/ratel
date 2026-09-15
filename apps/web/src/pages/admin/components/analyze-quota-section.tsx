import { useState } from "react";
import { useAdminLiteralsI18n } from "../admin-literals.i18n";
import { displayError, parseI64 } from "../hooks/format";
import { useAnalyzeQuota } from "../hooks/use-admin-main";
import { useDioxusInput } from "../hooks/use-dioxus-input";

// `AnalyzeQuotaSection` (admin/views/main/mod.rs): tunes
// `AnalyzeQuotaConfig.non_enterprise_limit`. The input starts at 2 whatever
// the loaded value is, exactly like the Rust signal.
export function AnalyzeQuotaSection() {
  const lit = useAdminLiteralsI18n();
  const { quota, save } = useAnalyzeQuota();
  const [inputLimit, setInputLimit] = useState(2);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<[string, boolean] | null>(null);
  const limitInput = useDioxusInput<HTMLInputElement>(String(inputLimit));

  const onSave = async () => {
    const limit = inputLimit;
    if (limit < 0) {
      setMessage([lit.text("quota_negative"), false]);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await save(limit);
      setSaving(false);
      setMessage([lit.text("quota_saved"), true]);
    } catch (err) {
      setSaving(false);
      setMessage([lit.fill("quota_save_failed", { err: displayError(err) }), false]);
    }
  };

  return (
    <section className="admin-arena__section">
      <div className="admin-arena__section-head">
        <span className="admin-arena__section-title">{lit.text("quota_title")}</span>
        <span className="admin-arena__section-meta">
          {quota.exists ? lit.text("quota_meta_saved") : lit.text("quota_meta_default")}
        </span>
      </div>
      <div className="admin-arena__form admin-arena__form--stretch">
        <label className="admin-arena__form-label" htmlFor="analyze-quota-limit">
          {lit.text("quota_label")}
        </label>
        <div className="admin-arena__form-row">
          <input
            id="analyze-quota-limit"
            className="admin-arena__form-input"
            type="number"
            min="0"
            {...limitInput}
            onInput={(e) => {
              const value = parseI64(e.currentTarget.value);
              if (value !== null) setInputLimit(value);
            }}
          />
          <button className="admin-arena__btn" type="button" disabled={saving} onClick={() => void onSave()}>
            {saving ? lit.text("quota_saving") : lit.text("quota_save")}
          </button>
        </div>
        <span className="admin-arena__form-hint">{lit.text("quota_hint")}</span>
        {message !== null && (
          <span
            className={message[1] ? "admin-arena__status admin-arena__status--ok" : "admin-arena__status admin-arena__status--err"}
          >
            {message[0]}
          </span>
        )}
      </div>
    </section>
  );
}
