import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { ChipBalance } from "@/components/arcade/chip-balance";
import { ArcadeExchangeModal } from "@/components/arcade/exchange-modal";
import {
  ARCADE_HOME_PATH,
  ARCADE_LEADERBOARD_PATH,
  FACT_FOLD_ADMIN_NEW_SUBJECT_PATH,
  FACT_FOLD_ROUND_PATTERN,
} from "@/components/arcade/paths";
import { monogram } from "@/components/arcade/format";
import { useArcadeLayoutI18n } from "@/i18n/generated/features/arcade/arcade-layout.i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";

// app/ratel/src/features/arcade/layout.rs (`ArcadeLayout`) — the top bar, the
// mobile drawer and the RP → chip exchange modal around every /arcade page.
// Rust provides `UseArcadeWallet` here; in React every consumer shares the
// `["getWallet"]` query instead (components/arcade/hooks/use-arcade-wallet.ts).

/** Rust `UserType::SystemAdmin` (common/types/auth/user_type.rs). */
const USER_TYPE_SYSTEM_ADMIN = 98;

export function Component() {
  const tr = useArcadeLayoutI18n();
  const { user } = useUserContext();
  const isAdmin = user?.user_type === USER_TYPE_SYSTEM_ADMIN;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onHome = useMatch(ARCADE_HOME_PATH) !== null;
  const onLeaderboard = useMatch(ARCADE_LEADERBOARD_PATH) !== null;
  // Mid-round the mobile hamburger is hidden via `[data-game-room="true"]`.
  const inGameRoom = useMatch(FACT_FOLD_ROUND_PATTERN) !== null;

  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer on every route change (back/forward included).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const onChip = () => setModalOpen((open) => !open);
  const onChipDrawer = () => {
    setMenuOpen(false);
    setModalOpen((open) => !open);
  };
  const closeMenu = () => setMenuOpen(false);
  const goAdminNew = () => {
    setMenuOpen(false);
    navigate(FACT_FOLD_ADMIN_NEW_SUBJECT_PATH);
  };

  return (
    <div className="ff-arcade">
      <header className="top-bar ff-arcade__top-bar" data-game-room={dataBool(inGameRoom)}>
        <div className="brand">
          <div className="brand-logo">R</div>
          <div className="brand-text">
            <div className="brand-name">{tr.brand}</div>
            <div className="brand-sub">{tr.brandSub}</div>
          </div>
        </div>
        <nav className="top-nav" role="tablist">
          <Link
            className="top-nav-btn"
            data-testid="ff-arcade-tab-home"
            aria-selected={dataBool(onHome)}
            aria-current={onHome ? "page" : undefined}
            to={ARCADE_HOME_PATH}
          >
            <span className="top-nav-btn-icon">⌂</span>
            <span>{tr.tabHome}</span>
          </Link>
          <Link
            className="top-nav-btn"
            data-testid="ff-arcade-tab-leaderboard"
            aria-selected={dataBool(onLeaderboard)}
            aria-current={onLeaderboard ? "page" : undefined}
            to={ARCADE_LEADERBOARD_PATH}
          >
            <span className="top-nav-btn-icon">♛</span>
            <span>{tr.tabLeaderboard}</span>
          </Link>
        </nav>
        <div className="user-stats">
          {isAdmin && (
            <button className="ff-arcade__admin-cta" data-testid="ff-arcade-admin-cta" onClick={goAdminNew}>
              <span className="top-nav-btn-icon">⚐</span>
              <span className="ff-arcade__admin-cta-label">{tr.adminCreateRound}</span>
            </button>
          )}
          <ChipBalance onClick={onChip} />
          <ArcadeAvatar />
          <button
            className="ff-arcade__menu-toggle"
            data-testid="ff-arcade-menu-toggle"
            aria-label={menuOpen ? tr.menuClose : tr.menuOpen}
            aria-haspopup="dialog"
            aria-expanded={dataBool(menuOpen)}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            ) : (
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
            <span className="hud-btn__label">{menuOpen ? tr.menuClose : tr.menuOpen}</span>
          </button>
        </div>
      </header>

      {/* Always mounted so the slide transition has both endpoints; CSS keys off data-open. */}
      <div className="ff-arcade__menu-scrim" data-open={dataBool(menuOpen)} aria-hidden="true" onClick={closeMenu} />
      <div className="ff-arcade__menu-drawer" data-open={dataBool(menuOpen)} aria-hidden={dataBool(!menuOpen)}>
        <nav className="ff-arcade__menu-nav" aria-label={tr.menuNavLabel} role="tablist">
          <Link
            className="top-nav-btn"
            aria-selected={dataBool(onHome)}
            aria-current={onHome ? "page" : undefined}
            to={ARCADE_HOME_PATH}
            onClick={closeMenu}
          >
            <span className="top-nav-btn-icon">⌂</span>
            <span>{tr.tabHome}</span>
          </Link>
          <Link
            className="top-nav-btn"
            aria-selected={dataBool(onLeaderboard)}
            aria-current={onLeaderboard ? "page" : undefined}
            to={ARCADE_LEADERBOARD_PATH}
            onClick={closeMenu}
          >
            <span className="top-nav-btn-icon">♛</span>
            <span>{tr.tabLeaderboard}</span>
          </Link>
          {isAdmin && (
            <button className="ff-arcade__admin-cta" onClick={goAdminNew}>
              <span className="top-nav-btn-icon">⚐</span>
              <span>{tr.adminCreateRound}</span>
            </button>
          )}
          <ChipBalance onClick={onChipDrawer} testid="ff-arcade-chip-drawer" />
        </nav>
      </div>

      <main className="ff-arcade__main">
        <Outlet />
      </main>

      <ArcadeExchangeModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

/** `ArcadeAvatar` — two-letter monogram of the session user, `?` without one. */
function ArcadeAvatar() {
  const { user } = useUserContext();
  const initials = user ? monogram(user.display_name || user.username || "?") : "?";
  return <div className="avatar">{initials}</div>;
}
