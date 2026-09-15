import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useConnectionsPageI18n } from "./i18n";
import { useToast } from "@/lib/toast";
import { BlueskyConnectModal } from "@/components/cross-posting/bluesky-connect-modal";
import { ConnectionsHero } from "./components/connections-hero";
import { ActivePlatformCard, SoonPlatformCard } from "./components/platform-cards";
import { BlueskyGlyph, FarcasterGlyph, LinkedinGlyph, ThreadsGlyph } from "./components/platform-icons";
import { useCrossPosting } from "./hooks/use-cross-posting";

// app/ratel/src/features/cross_posting/views/connections_page/component.rs
// (`ConnectionsPage`, routed as `UserSettingsConnectionsPage` at
// `/:username/settings/connections`, outside the social layout). The
// `username` segment is unused — the controller scopes by the session user.
export function Component() {
  const t = useConnectionsPageI18n();
  const cp = useCrossPosting();
  const toast = useToast();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const bsky = cp.connections.find((c) => c.platform === "bluesky");
  const linkedin = cp.connections.find((c) => c.platform === "linkedin");

  /** Rust `if let Err(e) = ….await { toast.error(e) }`. */
  const run = (action: Promise<void>) => {
    action.catch((e: unknown) => toast.error(e));
  };

  return (
    <>
      <SeoMeta title={t.title} />

      <BlueskyConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={(handle, appPassword) => {
          void cp.connectBluesky(handle, appPassword).then(
            () => setModalOpen(false),
            (e: unknown) => toast.error(e),
          );
        }}
      />

      <div className="connections-arena">
        <header className="arena-topbar">
          <div className="arena-topbar__left">
            <button className="back-btn" aria-label={t.btnBackAria} onClick={() => navigate(-1)}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="topbar-title">
              <span className="topbar-title__eyebrow">{t.eyebrow}</span>
              <span className="topbar-title__main">{t.title}</span>
            </div>
          </div>
        </header>

        <main className="connections-page">
          <ConnectionsHero connectedCount={cp.connectedCount} postsThisMonth={cp.postsThisMonth} />

          <div className="connections-section-head">
            <span className="connections-section-head__title">{t.sectionPlatforms}</span>
            <span className="connections-section-head__meta">{t.sectionMetaPhase1}</span>
          </div>

          <div className="platforms">
            <ActivePlatformCard
              platform="bsky"
              logo={<BlueskyGlyph />}
              name={t.blueskyName}
              limit={t.blueskyLimit}
              subtitleDefault={t.blueskySubtitleDefault}
              connection={bsky}
              handlePrefix="@"
              onConnect={() => setModalOpen(true)}
              onDisconnect={() => run(cp.disconnect("bluesky"))}
              onToggleAutoPost={(enabled) => run(cp.toggleAutoPost("bluesky", enabled))}
            />
            <ActivePlatformCard
              platform="linkedin"
              logo={<LinkedinGlyph />}
              name={t.linkedinName}
              limit={t.linkedinLimit}
              subtitleDefault={t.linkedinSubtitleDefault}
              connection={linkedin}
              handlePrefix=""
              onConnect={() => run(cp.connectLinkedin(null))}
              onDisconnect={() => run(cp.disconnect("linkedin"))}
              onToggleAutoPost={(enabled) => run(cp.toggleAutoPost("linkedin", enabled))}
            />
            <SoonPlatformCard
              platform="threads"
              logo={<ThreadsGlyph />}
              name={t.threadsName}
              status={t.statusComingSoon}
              limit={t.threadsLimit}
              subtitle={t.threadsSubtitle}
            />
            <SoonPlatformCard
              platform="farcaster"
              logo={<FarcasterGlyph />}
              name={t.farcasterName}
              status={t.statusPhase2}
              limit={t.farcasterLimit}
              subtitle={t.farcasterSubtitle}
            />
          </div>
        </main>
      </div>
    </>
  );
}
