import { useCharacterPageI18n } from "@/pages/me/character/i18n";
import type { CharacterResponse } from "../hooks/use-character";

// app/ratel/src/features/character/pages/character_page/character_hero/component.rs
// — level badge, XP bar and SP pill. Class names and ids follow
// app/ratel/assets/design/character-xp-skills/character-page.html.
export function CharacterHero({ response }: { response: CharacterResponse }) {
  const tr = useCharacterPageI18n();

  const level = response.level;
  const nextLevel = level + 1;
  const totalXp = response.total_xp;
  const progress = response.xp_progress_in_level;
  const span = Math.max(response.xp_span_of_level, 1); // avoid div-by-zero
  const remaining = Math.max(span - progress, 0);
  const pct = Math.round(Math.min(Math.max((progress / span) * 100, 0), 100));

  const unspentSp = response.unspent_sp;
  const spEmpty = unspentSp <= 0;
  const spHint = spEmpty ? tr.spHintEmpty : unspentSp === 1 ? tr.spHintOneReady : `${unspentSp} ${tr.spHintReady}`;

  return (
    // The Rust `aria_label` is a literal, not a translation.
    <section className="character-hero" aria-label="Character summary">
      <div className="character-hero__level">
        <span className="character-hero__level-label">{tr.levelLabel}</span>
        <span className="character-hero__level-num" id="hero-level" data-testid="hero-level">
          {level}
        </span>
      </div>

      <div className="character-hero__xp">
        <div className="character-hero__xp-meta">
          <span className="character-hero__xp-title">{tr.xpTitle}</span>
          <span className="character-hero__xp-numbers">
            <em id="hero-xp-current">{progress}</em>
            {" / "}
            <span id="hero-xp-needed">{span}</span>
          </span>
        </div>
        <div
          className="character-hero__xp-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="character-hero__xp-fill" id="hero-xp-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="character-hero__xp-hint">
          <span id="hero-xp-to-next">{`${remaining} ${tr.xpToNext} ${nextLevel}`}</span>
          {` · ${tr.xpTotalEarned}: `}
          <span id="hero-xp-total" data-testid="hero-xp-total">
            {totalXp}
          </span>
        </div>
      </div>

      <div className="character-hero__sp" id="hero-sp" data-empty={spEmpty ? "true" : undefined}>
        <span className="character-hero__sp-label">{tr.spLabel}</span>
        <span className="character-hero__sp-value" id="hero-sp-value" data-testid="hero-sp-value">
          {unspentSp}
        </span>
        <span className="character-hero__sp-hint" id="hero-sp-hint">
          {spHint}
        </span>
      </div>
    </section>
  );
}
