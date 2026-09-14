import { useState } from "react";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { SettingsPanel } from "@/components/settings-panel/settings-panel";
import { Robots, SeoMeta } from "@/components/ui/seo-meta";
import { useLegacyScript } from "@/lib/legacy-scripts";
import homeScript from "../../../../app/ratel/src/views/index/script.js?url&no-inline";
import { HomeBottomBar } from "./components/home-bottom-bar";
import { HomeCarousel, HomeTab } from "./components/home-carousel";
import { HomeMenuOverlay } from "./components/home-menu-overlay";
import { HomeTopbar } from "./components/home-topbar";
import { useHomeArena, type UseHomeArena } from "./hooks/use-home-arena";

// app/ratel/src/views/index/component.rs (`Index`, `/`) — the home arena: HUD
// topbar, hot / my / invited spaces and "My Posts" carousel, bottom HUD,
// settings panel, hamburger overlay and (signed in) the notification panel.
// The page's unmodified `script.js` drives the carousel focus and dots.

// SEO values Rust hardcodes (component.rs:108-121, 225-232).
const SEO_TITLE = "Ratel – Human Essence Platform";
const SEO_DESCRIPTION =
  "Turn your thoughts into your Essence. Post, discuss, vote — then plug your Essence House into ChatGPT or Claude via a single MCP endpoint, deploy agents, and earn passive income.";
const SEO_IMAGE = "https://metadata.ratel.foundation/logos/logo-symbol.png";
const SEO_URL = "https://ratel.foundation";
const SEO_KEYWORDS = [
  "ratel",
  "human essence platform",
  "essence house",
  "personal ai agent",
  "mcp subscription",
  "passive income ai",
  "rag knowledge base",
  "notion to ai",
  "creator monetization",
  "collective intelligence",
];

export function Component() {
  useLegacyScript(homeScript);
  const home = useHomeArena();

  return (
    <>
      <SeoMeta
        title={SEO_TITLE}
        description={SEO_DESCRIPTION}
        image={SEO_IMAGE}
        url={SEO_URL}
        robots={Robots.IndexNofollow}
        keywords={SEO_KEYWORDS}
      />
      {home.ready && <HomeArena home={home} />}
    </>
  );
}

function HomeArena({ home }: { home: UseHomeArena }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Chosen once, on the first render with data (component.rs:142-147).
  const [tab, setTab] = useState<HomeTab>(() => (home.hasUser && home.mineCards.length > 0 ? HomeTab.Mine : HomeTab.Hot));

  const cards =
    tab === HomeTab.Hot ? home.hotCards : tab === HomeTab.Mine ? home.mineCards : tab === HomeTab.Invited ? home.invitedCards : [];

  return (
    <>
      <div className="home-arena home-arena--standalone">
        <HomeTopbar
          hasUser={home.hasUser}
          isAdmin={home.isAdmin}
          teams={home.teams}
          teamsOpen={teamsOpen}
          setTeamsOpen={setTeamsOpen}
          onToggleNotifications={() => setNotificationsOpen((open) => !open)}
          onArcade={() => home.authNavigate("/arcade/home")}
          onSettings={() => setSettingsOpen(true)}
          onMenu={() => setMenuOpen(true)}
        />

        <div className="home-arena__scroll">
          <HomeCarousel hasUser={home.hasUser} tab={tab} onTab={setTab} cards={cards} posts={home.posts} />
          <HomeBottomBar hasUser={home.hasUser} activeSpaces={home.hotCards.length} />
        </div>

        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

        <HomeMenuOverlay
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onCompose={() => void home.createPost()}
          onDrafts={() => home.authNavigate((user) => `/${user.username}/drafts`)}
          onMyAi={() => home.authNavigate("/my-ai")}
          onRewards={() => home.authNavigate((user) => `/${user.username}/rewards`)}
          onEssence={() => home.authNavigate("/essence")}
          onCredentials={() => home.authNavigate("/credentials")}
        />
      </div>

      {home.hasUser && <NotificationPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />}
    </>
  );
}
