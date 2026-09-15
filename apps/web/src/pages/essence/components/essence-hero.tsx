import { useEssenceSourcesI18n } from "@/pages/essence/i18n";
import { useEssenceSources } from "../hooks/use-essence-sources";
import { formatThousands } from "./format";

// app/ratel/src/features/essence/pages/sources/hero/component.rs — totals
// come from the `UserEssenceStats` singleton, not the loaded page.
export function EssenceHero() {
  const tr = useEssenceSourcesI18n();
  const { stats } = useEssenceSources();
  const totalSources = Math.max(stats.total_sources, 0);
  const totalWords = Math.max(stats.total_words, 0);

  return (
    <section className="essence-hero">
      <div className="essence-hero__main">
        <span className="essence-hero__eyebrow">{tr.heroEyebrow}</span>
        <h1 className="essence-hero__title">
          <span className="essence-hero__title-count">{formatThousands(totalSources)}</span>
          {` ${tr.heroSourcesWord} · ${formatThousands(totalWords)} ${tr.heroWordsWord}`}
        </h1>
        <p className="essence-hero__sub">{tr.heroSubtitle}</p>
      </div>
    </section>
  );
}
