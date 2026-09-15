import {
  useCharacterPageI18n,
  type CharacterPageI18n,
} from "@/pages/me/character/i18n";
import type { CharacterSkillResponse, SkillId } from "../hooks/use-character";

// app/ratel/src/features/character/pages/character_page/skill_card/component.rs
// — one card of the skill grid; class names and data attributes follow the
// character-xp-skills mockup.

function skillCopy(tr: CharacterPageI18n, id: SkillId): [name: string, sub: string, desc: string] {
  switch (id) {
    case "money_tree":
      return [tr.moneyTreeName, tr.moneyTreeSub, tr.moneyTreeDesc];
    case "ranker":
      return [tr.rankerName, tr.rankerSub, tr.rankerDesc];
    case "influencer":
      return [tr.influencerName, tr.influencerSub, tr.influencerDesc];
    case "sweeper":
      return [tr.sweeperName, tr.sweeperSub, tr.sweeperDesc];
  }
}

export interface SkillCardProps {
  response: CharacterSkillResponse;
  unspentSp: number;
  onLevelup: (id: SkillId) => void;
}

export function SkillCard({ response, unspentSp, onLevelup }: SkillCardProps) {
  const tr = useCharacterPageI18n();

  const skillId = response.skill_id;
  const level = response.level;
  const maxLevel = response.max_level;
  const cost = response.next_level_cost;
  const isReleased = response.is_released;
  const isMaxed = level >= maxLevel;
  const [name, sub, desc] = skillCopy(tr, skillId);

  const multiplierPct = level * 5;
  const nextPct = (level + 1) * 5;
  const pipFilled = Array.from({ length: Math.max(maxLevel, 0) }, (_, i) => i < level);
  const costDisabled = cost === null ? true : unspentSp < cost;

  return (
    <article className="skill-card" data-skill={skillId} data-locked={!isReleased ? "true" : undefined}>
      <div className="skill-card__head">
        <span className="skill-card__icon" aria-hidden="true">
          <SkillIcon id={skillId} />
        </span>
        <div className="skill-card__title-block">
          <div className="skill-card__name">{name}</div>
          <div className="skill-card__name-ko">{sub}</div>
        </div>
        {isReleased ? (
          <span className="skill-card__multiplier">{`+${multiplierPct}%`}</span>
        ) : (
          <span className="skill-card__lock-tag">{tr.comingSoon}</span>
        )}
      </div>

      <p className="skill-card__desc">{desc}</p>

      <div className="skill-card__pips" role="meter" aria-valuemin={0} aria-valuemax={maxLevel} aria-valuenow={level}>
        {pipFilled.map((filled, i) => (
          <span key={i} className="skill-card__pip" data-filled={filled ? "true" : undefined} />
        ))}
      </div>

      <footer className="skill-card__footer">
        <div className="skill-card__level-meta">
          {isReleased ? (
            <>
              <span className="skill-card__level-meta-label">{tr.levelMetaLabel}</span>
              <span className="skill-card__level-meta-value">{`${level} / ${maxLevel}`}</span>
              {isMaxed ? (
                <span className="skill-card__level-meta-next">{tr.maxReached}</span>
              ) : (
                <span className="skill-card__level-meta-next">{`${tr.nextBoost}${nextPct}${tr.nextWas}${multiplierPct}%)`}</span>
              )}
            </>
          ) : (
            <>
              <span className="skill-card__level-meta-label">{tr.statusMetaLabel}</span>
              <span className="skill-card__level-meta-value">{tr.notReleased}</span>
            </>
          )}
        </div>

        {isReleased ? (
          isMaxed ? (
            <span className="skill-card__maxed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {tr.maxedLabel}
            </span>
          ) : cost !== null ? (
            <button
              className="skill-card__levelup"
              type="button"
              data-testid={`skill-levelup-${skillId}`}
              disabled={costDisabled}
              onClick={() => onLevelup(skillId)}
            >
              <span>{tr.levelupLabel}</span>
              <span className="skill-card__levelup-cost">{`${cost} ${tr.spUnit}`}</span>
            </button>
          ) : null
        ) : (
          <span className="skill-card__locked-cta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>{tr.lockedLabel}</span>
          </span>
        )}
      </footer>
    </article>
  );
}

/** Rust `skill_icon` — per-skill SVG from the mockup. */
function SkillIcon({ id }: { id: SkillId }) {
  switch (id) {
    case "money_tree":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="5" />
          <path d="M12 13v8" />
          <path d="M9 18h6" />
          <path d="M9 8h6" />
        </svg>
      );
    case "ranker":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 11 12 6 7 11" />
          <polyline points="17 18 12 13 7 18" />
        </svg>
      );
    case "influencer":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11v2a4 4 0 0 0 4 4h1l5 4V5L8 9H7a4 4 0 0 0-4 2Z" />
          <path d="M16 8a5 5 0 0 1 0 8" />
        </svg>
      );
    case "sweeper":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 11 6 19" />
          <path d="m21 4-7 7" />
          <path d="M3 21h18" />
          <path d="M5 16h6" />
        </svg>
      );
  }
}
