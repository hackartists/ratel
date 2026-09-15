import { Internet } from "@/components/icons/internet-script";
import { Lock1 } from "@/components/icons/security";
import { useGeneralI18n } from "@/pages/spaces/[spaceId]/apps/general/i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { dataBool } from "@/lib/dom";
import { useSpaceGeneralSettings } from "../hooks/use-space-general-settings";

// general/views/home/space_visibility_setting.rs — Public / Private radio cards.
// `SpaceVisibility` is serialized by `DynamoEnum` Display: "PUBLIC" / "PRIVATE".
export function SpaceVisibilitySetting() {
  const tr = useGeneralI18n();
  const { space } = useSpaceAppsContext();
  const { updateVisibility } = useSpaceGeneralSettings();

  const isPublic = space.visibility === "PUBLIC";
  const pending = updateVisibility.pending;

  return (
    <section className="sga-section" data-testid="section-visibility">
      <div className="sga-section__head">
        <span className="sga-section__label">{tr.spaceVisibility}</span>
        <span className="sga-section__hint">{tr.spaceVisibilityDescription}</span>
      </div>
      <div className="sga-radio-cards">
        <button
          type="button"
          className="sga-radio-card"
          aria-selected={dataBool(isPublic)}
          data-testid="visibility-public"
          disabled={pending || isPublic}
          onClick={() => updateVisibility.call("PUBLIC")}
        >
          <span className="sga-radio-card__title">
            <Internet className="[&>path]:stroke-current [&>path]:fill-none [&>circle]:stroke-current [&>circle]:fill-none [&>ellipse]:stroke-current [&>ellipse]:fill-none" />
            {tr.publicSpace}
          </span>
          <span className="sga-radio-card__desc">{tr.publicSpaceDesc}</span>
        </button>
        <button
          type="button"
          className="sga-radio-card"
          aria-selected={dataBool(!isPublic)}
          data-testid="visibility-private"
          disabled={pending || !isPublic}
          onClick={() => updateVisibility.call("PRIVATE")}
        >
          <span className="sga-radio-card__title">
            <Lock1 className="[&>path]:stroke-current [&>path]:fill-none" />
            {tr.privateSpace}
          </span>
          <span className="sga-radio-card__desc">{tr.privateSpaceDesc}</span>
        </button>
      </div>
    </section>
  );
}
