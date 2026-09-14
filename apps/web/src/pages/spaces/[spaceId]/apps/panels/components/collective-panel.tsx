import { useRef, useState } from "react";
import { usePanelsI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/panels/panels.i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { dataBool } from "@/lib/dom";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";
import { isCollectiveOption } from "../hooks/panel-logic";
import { useSpacePanels } from "../hooks/use-space-panels";

// panels/views/home/collective_panel.rs — the collective attribute chips and,
// when the space has a quota, a "+" menu (and per-chip arrows) moving Age /
// Gender into the conditional table. A press outside the menu closes it.
export function CollectivePanelSection() {
  const tr = usePanelsI18n();
  // space-context: `use_space()`.
  const { space } = useSpaceAppsContext();
  const { panels, moveToConditional } = useSpacePanels();

  const [showMenu, setShowMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(dropdownRef, showMenu, setShowMenu);

  const hasUni = isCollectiveOption("University", panels);
  const hasAge = isCollectiveOption("Age", panels);
  const hasGen = isCollectiveOption("Gender", panels);
  const hasAny = hasUni || hasAge || hasGen;

  const currentQuota = space.quota;
  const canMoveAge = hasAge && currentQuota > 0;
  const canMoveGender = hasGen && currentQuota > 0;
  const hasMovable = canMoveAge || canMoveGender;

  const arrow = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );

  return (
    <section className="spa-section" data-testid="section-collective">
      <div className="spa-section__head">
        <div className="spa-section__title">
          <span className="spa-section__label">{tr.collectiveTitle}</span>
        </div>
        {hasMovable && (
          <div className="spa-section__actions">
            <div className="spa-dropdown" id="collective-dropdown" ref={dropdownRef}>
              <button
                type="button"
                className="spa-btn spa-btn--icon"
                aria-label={tr.moveToConditionalAria}
                data-testid="collective-add-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <div className="spa-dropdown-menu" data-open={dataBool(showMenu)} data-testid="collective-menu">
                {canMoveAge && (
                  <button
                    type="button"
                    className="spa-dropdown-menu__item"
                    data-testid="collective-move-age"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      moveToConditional.call("Age");
                    }}
                  >
                    {tr.moveAgeToConditional}
                  </button>
                )}
                {canMoveGender && (
                  <button
                    type="button"
                    className="spa-dropdown-menu__item"
                    data-testid="collective-move-gender"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      moveToConditional.call("Gender");
                    }}
                  >
                    {tr.moveGenderToConditional}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <span className="spa-section__hint">{tr.collectiveHint}</span>

      {hasAny ? (
        <div className="spa-collective-row" data-testid="collective-list">
          {hasUni && (
            <span className="spa-collective-chip spa-collective-chip--uni">
              <span className="spa-collective-chip__dot" />
              {tr.attrUniversity}
            </span>
          )}
          {hasAge && (
            <span className="spa-collective-chip spa-collective-chip--age">
              <span className="spa-collective-chip__dot" />
              {tr.attrAge}
              {canMoveAge && (
                <button
                  type="button"
                  className="spa-collective-chip__action"
                  aria-label={tr.moveToConditionalAria}
                  data-testid="collective-move-age-chip"
                  onClick={() => moveToConditional.call("Age")}
                >
                  {arrow}
                </button>
              )}
            </span>
          )}
          {hasGen && (
            <span className="spa-collective-chip spa-collective-chip--gen">
              <span className="spa-collective-chip__dot" />
              {tr.attrGender}
              {canMoveGender && (
                <button
                  type="button"
                  className="spa-collective-chip__action"
                  aria-label={tr.moveToConditionalAria}
                  data-testid="collective-move-gender-chip"
                  onClick={() => moveToConditional.call("Gender")}
                >
                  {arrow}
                </button>
              )}
            </span>
          )}
        </div>
      ) : (
        <div className="spa-empty-hint">{tr.collectiveEmpty}</div>
      )}
    </section>
  );
}
