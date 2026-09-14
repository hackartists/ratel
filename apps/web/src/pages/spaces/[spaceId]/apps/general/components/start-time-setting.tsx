import { useEffect, useRef, useState } from "react";
import { useGeneralI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/general/general.i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { useSpaceGeneralSettings } from "../hooks/use-space-general-settings";
import { datetimeLocalToEpochMs, epochMsToDatetimeLocal } from "./format";

// general/views/home/start_time_setting.rs — a datetime-local input showing
// `started_at` (or `created_at`); the native `change` event saves it, and a
// click anywhere on the field opens the picker.
export function StartTimeSetting() {
  const tr = useGeneralI18n();
  const { space } = useSpaceAppsContext();
  const { updateStartTime } = useSpaceGeneralSettings();

  const inputValue = epochMsToDatetimeLocal(space.started_at ?? space.created_at);

  // The DOM keeps what the user typed until the server value changes, like
  // Dioxus only patching `value` when the rendered string changes.
  const [draft, setDraft] = useState(inputValue);
  const [synced, setSynced] = useState(inputValue);
  if (synced !== inputValue) {
    setSynced(inputValue);
    setDraft(inputValue);
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const commit = useRef<(raw: string) => void>(() => {});
  commit.current = (raw) => {
    const ms = datetimeLocalToEpochMs(raw);
    if (ms !== null) updateStartTime.call(ms);
  };

  // Rust `onchange` (committed value), not React's per-keystroke `onChange`.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onChange = () => commit.current(el.value);
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, []);

  return (
    <section className="sga-section" data-testid="section-start-time">
      <div className="sga-section__head">
        <span className="sga-section__label">{tr.startTimeSetting}</span>
        <span className="sga-section__hint">{tr.startTimeDescription}</span>
      </div>
      <div className="sga-field">
        <label className="sga-field__label">Started at</label>
        <input
          ref={inputRef}
          className="sga-input sga-input--datetime"
          type="datetime-local"
          value={draft}
          data-testid="start-time-input"
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // Not supported / not user-activated: the built-in icon still works.
            }
          }}
          onChange={(e) => setDraft(e.currentTarget.value)}
        />
      </div>
    </section>
  );
}
