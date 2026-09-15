import { useConnectionsPageI18n } from "@/pages/[username]/settings/connections/i18n";
import { BlueskyGlyph, LinkedinGlyph, ThreadsGlyph } from "./platform-icons";

// Hero section of views/connections_page/component.rs (headline, stats, orbit).
export function ConnectionsHero({ connectedCount, postsThisMonth }: { connectedCount: number; postsThisMonth: number }) {
  const t = useConnectionsPageI18n();

  return (
    <section className="connections-hero">
      <div className="connections-hero__main">
        <span className="connections-hero__eyebrow">
          <BlueskyGlyph />
          {t.heroEyebrow}
        </span>
        <h1 className="connections-hero__title">
          {`${t.heroTitle} `}
          <span className="connections-hero__title-accent">{t.heroTitleAccent}</span>
        </h1>
        <p className="connections-hero__sub">{t.heroSub}</p>
        <div className="connections-hero__stats">
          <div className="connections-hero__stat">
            <span className="connections-hero__stat-value connections-hero__stat-value--accent">{connectedCount}</span>
            <span className="connections-hero__stat-label">{t.statConnected}</span>
          </div>
          <div className="connections-hero__stat">
            <span className="connections-hero__stat-value">{postsThisMonth}</span>
            <span className="connections-hero__stat-label">{t.statThisMonth}</span>
          </div>
        </div>
      </div>
      <div className="connections-hero__orbit" aria-hidden="true">
        <div className="connections-hero__orbit-ring" />
        <div className="connections-hero__orbit-ring connections-hero__orbit-ring--inner" />
        <div className="connections-hero__orbit-core">RATEL</div>
        <div className="connections-hero__orbit-chip connections-hero__orbit-chip--bsky">
          <BlueskyGlyph />
        </div>
        <div className="connections-hero__orbit-chip connections-hero__orbit-chip--linkedin">
          <LinkedinGlyph />
        </div>
        <div className="connections-hero__orbit-chip connections-hero__orbit-chip--threads">
          <ThreadsGlyph />
        </div>
      </div>
    </section>
  );
}
