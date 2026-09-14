import { useGeneralI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/general/general.i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { dataBool } from "@/lib/dom";
import { useSpaceGeneralSettings } from "../hooks/use-space-general-settings";

// general/views/home/{anonymous_setting,join_anytime_setting}.rs — an arena
// switch card each. A click while the update is pending is ignored.

interface ArenaSwitchProps {
  sectionTestId: string;
  switchTestId: string;
  label: string;
  sub: string;
  enabled: boolean;
  pending: boolean;
  onToggle: (next: boolean) => void;
}

function ArenaSwitchSection({ sectionTestId, switchTestId, label, sub, enabled, pending, onToggle }: ArenaSwitchProps) {
  return (
    <section className="sga-section" data-testid={sectionTestId}>
      <div className="sga-section__head">
        <span className="sga-section__label">{label}</span>
      </div>
      <button
        type="button"
        className="sga-switch"
        role="switch"
        tabIndex={0}
        aria-checked={dataBool(enabled)}
        aria-disabled={dataBool(pending)}
        data-testid={switchTestId}
        onClick={() => {
          if (!pending) onToggle(!enabled);
        }}
      >
        <span className="sga-switch__track">
          <span className="sga-switch__thumb" />
        </span>
        <span className="sga-switch__body">
          <span className="sga-switch__label">{label}</span>
          <span className="sga-switch__sub">{sub}</span>
        </span>
      </button>
    </section>
  );
}

export function AnonymousSetting() {
  const tr = useGeneralI18n();
  // space-context: `use_space()`.
  const { space } = useSpaceAppsContext();
  const { updateAnonymous } = useSpaceGeneralSettings();
  return (
    <ArenaSwitchSection
      sectionTestId="section-anonymous"
      switchTestId="anonymous-switch"
      label={tr.anonymousSetting}
      sub={tr.anonymousSettingDescription}
      enabled={space.anonymous_participation}
      pending={updateAnonymous.pending}
      onToggle={(next) => updateAnonymous.call(next)}
    />
  );
}

export function JoinAnytimeSetting() {
  const tr = useGeneralI18n();
  // space-context: `use_space()`.
  const { space } = useSpaceAppsContext();
  const { updateJoinAnytime } = useSpaceGeneralSettings();
  return (
    <ArenaSwitchSection
      sectionTestId="section-join-anytime"
      switchTestId="join-anytime-switch"
      label={tr.joinAnytimeSetting}
      sub={tr.joinAnytimeDescription}
      enabled={space.join_anytime}
      pending={updateJoinAnytime.pending}
      onToggle={(next) => updateJoinAnytime.call(next)}
    />
  );
}
