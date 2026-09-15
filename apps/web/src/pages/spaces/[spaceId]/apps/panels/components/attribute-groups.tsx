import { usePanelsI18n } from "@/pages/spaces/[spaceId]/apps/panels/i18n";
import { dataBool } from "@/lib/dom";
import { isSelectedOption } from "../hooks/panel-logic";
import { useSpacePanels } from "../hooks/use-space-panels";

// panels/views/home/attribute_groups.rs — University / Age / Gender toggle cards;
// flipping one rebuilds the panel rows.
export function AttributeGroupsSection() {
  const tr = usePanelsI18n();
  const { panels, toggleAttribute } = useSpacePanels();

  return (
    <section className="spa-section" data-testid="section-attribute-groups">
      <div className="spa-section__head">
        <div className="spa-section__title">
          <span className="spa-section__label">{tr.attributeGroups}</span>
        </div>
        <span className="spa-section__hint">{tr.attributeGroupsHint}</span>
      </div>
      <div className="spa-attr-toggles" data-testid="attr-toggles">
        <AttributeToggleCard
          modifier="spa-attr-toggle--uni"
          name={tr.attrUniversity}
          desc={tr.attrUniversityDesc}
          selected={isSelectedOption("University", panels)}
          testid="attr-university"
          onClick={() => toggleAttribute.call("University")}
        />
        <AttributeToggleCard
          modifier="spa-attr-toggle--age"
          name={tr.attrAge}
          desc={tr.attrAgeDesc}
          selected={isSelectedOption("Age", panels)}
          testid="attr-age"
          onClick={() => toggleAttribute.call("Age")}
        />
        <AttributeToggleCard
          modifier="spa-attr-toggle--gen"
          name={tr.attrGender}
          desc={tr.attrGenderDesc}
          selected={isSelectedOption("Gender", panels)}
          testid="attr-gender"
          onClick={() => toggleAttribute.call("Gender")}
        />
      </div>
    </section>
  );
}

function AttributeToggleCard({
  modifier,
  name,
  desc,
  selected,
  testid,
  onClick,
}: {
  modifier: string;
  name: string;
  desc: string;
  selected: boolean;
  testid: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`spa-attr-toggle ${modifier}`} aria-selected={dataBool(selected)} data-testid={testid} onClick={onClick}>
      <div className="spa-attr-toggle__head">
        <span className="spa-attr-toggle__name">
          <span className="spa-attr-toggle__swatch" />
          {name}
        </span>
        <span className="spa-attr-toggle__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </div>
      <div className="spa-attr-toggle__desc">{desc}</div>
    </button>
  );
}
