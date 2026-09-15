import { useLevelChipI18n } from "./i18n";
import { usePublicLevel } from "./use-public-level";

// app/ratel/src/features/character/components/level_chip/component.rs
// (`LevelChip`): the public "Level X" chip. Class names come from the
// character-xp-skills mockup and are styled by main.css. Suspends until the
// level loads; any error falls back to level 1.
export function LevelChip({ username }: { username: string }) {
  const tr = useLevelChipI18n();
  const level = usePublicLevel(username);
  const subLabel = level <= 1 ? tr.justJoined : tr.ratelCharacter;

  return (
    <span className="character-level-chip" data-level={`${level}`} title={`${tr.levelLabel} ${level}`}>
      <span className="character-level-chip__label">{tr.levelLabel}</span>
      <span className="character-level-chip__num">{level}</span>
      <span className="character-level-chip__sub">{subLabel}</span>
    </span>
  );
}
