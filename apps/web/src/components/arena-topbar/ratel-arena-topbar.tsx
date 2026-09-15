import { useCreatePost } from "@ratel/ts-bridges/hooks";
import { useNavigate } from "react-router-dom";
import { LOGIN_MODAL_TITLE, useLoginModal } from "@/components/auth";
import { useRatelArenaTopbarI18n } from "./i18n";
import { useUserContext } from "@/lib/auth";

// app/ratel/src/components/arena_topbar/component.rs — the shared arena topbar
// (Home Arena keeps its own inline one). Kept under components/ like the Rust
// crate-level `components::RatelArenaTopbar`, which is meant for every
// per-feature arena page (today: Character).
//
// The section matching the current page gets `aria-current="page"`, which the
// `.hud-btn[aria-current="page"]` rules in main.css highlight.

export const RatelArenaTopbarSection = {
  Home: "Home",
  Character: "Character",
} as const;
export type RatelArenaTopbarSection = (typeof RatelArenaTopbarSection)[keyof typeof RatelArenaTopbarSection];

const BRAND_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

export function RatelArenaTopbar({ active }: { active?: RatelArenaTopbarSection }) {
  const t = useRatelArenaTopbarI18n();
  const navigate = useNavigate();
  // Rust reads the signed-in user from `use_user_context()` (component.rs:32-38);
  // every button except Settings opens `LoginModal` when signed out, else navigates.
  const username = useUserContext().user?.username ?? null;

  const loginModal = useLoginModal();
  const createPost = useCreatePost();

  /**
   * Signed out: Rust opens `LoginModal { on_success: on_login_success }` (a
   * no-op callback) with the title "Start building your Essence"
   * (component.rs:42-50).
   */
  const openLogin = () => loginModal.open({ title: LOGIN_MODAL_TITLE, onSuccess: () => {} });

  /** Rust `go_*` handlers: the login modal when signed out, else navigate. */
  const requireUser = (go: (username: string) => void) => () => {
    if (username === null) {
      openLogin();
      return;
    }
    go(username);
  };

  const isHome = active === RatelArenaTopbarSection.Home;
  const isCharacter = active === RatelArenaTopbarSection.Character;

  return (
    <div className="arena-topbar">
      <div className="arena-topbar__brand">
        <img className="arena-topbar__logo" src={BRAND_LOGO} alt="Ratel logo" />
        <span className="arena-topbar__title">{t.brandTitle}</span>
        <span className="arena-topbar__status">{t.liveStatus}</span>
      </div>
      <div className="arena-topbar__actions">
        <button
          className="hud-btn hud-btn--primary"
          aria-label={t.create}
          aria-current={isHome ? "page" : undefined}
          data-testid="home-btn-create"
          // Signed in: `create_post_handler(None)`, then the post editor for the
          // new post (component.rs:52-64). Rust only logs a failure.
          onClick={requireUser(() =>
            createPost.mutate(null, {
              // `post_pk` is the `Partition` string (`FEED#<id>`); the route takes the id.
              onSuccess: (resp) => navigate(`/posts/${resp.post_pk.replace(/^FEED#/, "")}/edit`),
              onError: (e) => console.error("Failed to create post:", e),
            }),
          )}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span className="hud-btn__label">{t.create}</span>
        </button>
        <button
          className="hud-btn"
          aria-label={t.drafts}
          data-testid="home-btn-drafts"
          onClick={requireUser((u) => navigate(`/${u}/drafts`))}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </svg>
          <span className="hud-btn__label">{t.drafts}</span>
        </button>
        <button
          className="hud-btn"
          aria-label={t.rewards}
          data-testid="home-btn-rewards"
          onClick={requireUser((u) => navigate(`/${u}/rewards`))}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
          <span className="hud-btn__label">{t.rewards}</span>
        </button>
        <button
          className="hud-btn"
          aria-label={t.credentials}
          data-testid="home-btn-credentials"
          onClick={requireUser(() => navigate("/credentials"))}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span className="hud-btn__label">{t.credentials}</span>
        </button>
        <button
          className="hud-btn"
          aria-label={t.character}
          aria-current={isCharacter ? "page" : undefined}
          data-testid="home-btn-character"
          onClick={requireUser(() => navigate("/me/character"))}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="6" />
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
          </svg>
          <span className="hud-btn__label">{t.character}</span>
        </button>
        <button
          className="hud-btn hud-btn--ai"
          aria-label={t.myAi}
          data-testid="home-btn-my-ai"
          onClick={requireUser(() => navigate("/my-ai"))}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3 13.6 9.4 20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" />
            <path d="M19 4 19.7 6.3 22 7l-2.3 0.7L19 10l-0.7-2.3L16 7l2.3-0.7L19 4Z" opacity="0.7" strokeWidth="1.2" />
          </svg>
          <span className="hud-btn__label">{t.myAi}</span>
        </button>
        <button
          className="hud-btn"
          aria-label={t.essence}
          data-testid="home-btn-essence"
          onClick={requireUser(() => navigate("/essence"))}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span className="hud-btn__label">{t.essence}</span>
        </button>
        <button
          className="hud-btn"
          aria-label={t.arcade}
          data-testid="home-btn-arcade"
          onClick={requireUser(() => navigate("/arcade/home"))}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8" cy="8" r="1" />
            <circle cx="16" cy="8" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="8" cy="16" r="1" />
            <circle cx="16" cy="16" r="1" />
          </svg>
          <span className="hud-btn__label">{t.arcade}</span>
        </button>
        <button
          className="hud-btn"
          aria-label={t.connections}
          data-testid="home-btn-connections"
          onClick={requireUser((u) => navigate(`/${u}/settings/connections`))}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" />
          </svg>
          <span className="hud-btn__label">{t.connections}</span>
        </button>
        <button
          className="hud-btn"
          aria-label={t.settings}
          data-testid="home-btn-settings"
          // The settings panel lives in the Home Arena; go home (no user needed).
          onClick={() => navigate("/")}
        >
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="hud-btn__label">{t.settings}</span>
        </button>
      </div>
    </div>
  );
}
