import { RatelArenaTopbar, RatelArenaTopbarSection } from "@/components/arena-topbar/ratel-arena-topbar";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useCharacterPageI18n } from "@/i18n/generated/features/character/pages/character_page/character-page.i18n";
import { CharacterHero } from "./components/character-hero";
import { SkillCard } from "./components/skill-card";
import { useCharacter } from "./hooks/use-character";

// app/ratel/src/features/character/pages/character_page/component.rs
// (`CharacterPage`, `/me/character`) — hero panel + skill grid.
export function Component() {
  const tr = useCharacterPageI18n();
  const { character, levelUp } = useCharacter();

  return (
    <>
      <SeoMeta title={tr.pageTitle} />
      <div className="character-arena">
        <RatelArenaTopbar active={RatelArenaTopbarSection.Character} />

        <main className="character-page" id="character-page">
          <CharacterHero response={character} />

          <header className="section-header">
            <h2 className="section-header__title">{tr.skillTreeTitle}</h2>
            <span className="section-header__hint">{tr.skillTreeHint}</span>
          </header>

          <div className="skill-grid">
            {character.skills.map((skill) => (
              <SkillCard key={skill.skill_id} response={skill} unspentSp={character.unspent_sp} onLevelup={levelUp} />
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
