import { useHomeArenaI18n } from "@/i18n/generated/views/index/home-arena.i18n";
import { dataBool } from "@/lib/dom";

// app/ratel/src/views/index/component.rs:696-879 — the hamburger overlay: a
// flat tile grid, always rendered; `data-open` flips its visibility (main.css).
// A press on the backdrop closes it; presses inside the panel don't bubble.
// Every tile closes the overlay first, then runs its action.

export interface HomeMenuOverlayProps {
  open: boolean;
  onClose: () => void;
  onCompose: () => void;
  onDrafts: () => void;
  onMyAi: () => void;
  onRewards: () => void;
  onEssence: () => void;
  onCredentials: () => void;
}

export function HomeMenuOverlay({ open, onClose, onCompose, onDrafts, onMyAi, onRewards, onEssence, onCredentials }: HomeMenuOverlayProps) {
  const t = useHomeArenaI18n();
  const tile = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div className="hud-overlay" role="dialog" aria-modal="true" aria-label={t.menu} data-open={dataBool(open)} onClick={() => onClose()}>
      <div className="hud-overlay__panel" onClick={(e) => e.stopPropagation()}>
        <button className="hud-overlay__close" aria-label={t.closeMenu} data-testid="home-menu-close" onClick={() => onClose()}>
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="hud-overlay__heading">{t.menu}</div>
        <div className="hud-overlay__grid">
          <button className="hud-overlay__tile hud-overlay__tile--primary" type="button" data-testid="home-menu-compose" onClick={tile(onCompose)}>
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span className="hud-overlay__tile-label">{t.composePost}</span>
          </button>
          <button className="hud-overlay__tile" type="button" data-testid="home-menu-drafts" onClick={tile(onDrafts)}>
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="hud-overlay__tile-label">{t.drafts}</span>
          </button>
          <button className="hud-overlay__tile" type="button" data-testid="home-menu-my-ai" onClick={tile(onMyAi)}>
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3 13.6 9.4 20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" />
            </svg>
            <span className="hud-overlay__tile-label">{t.aiAssist}</span>
          </button>
          <button className="hud-overlay__tile" type="button" data-testid="home-menu-rewards" onClick={tile(onRewards)}>
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
            <span className="hud-overlay__tile-label">{t.rewards}</span>
          </button>
          <button className="hud-overlay__tile" type="button" data-testid="home-menu-essence" onClick={tile(onEssence)}>
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className="hud-overlay__tile-label">{t.essence}</span>
          </button>
          <button className="hud-overlay__tile" type="button" data-testid="home-menu-credentials" onClick={tile(onCredentials)}>
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span className="hud-overlay__tile-label">{t.credentials}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
