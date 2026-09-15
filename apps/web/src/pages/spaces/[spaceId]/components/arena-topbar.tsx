import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useLikePost, useUpdateSpace } from "@ratel/ts-bridges/hooks";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { isSpaceAdmin, SpacePublishState, SpaceStatus, useSpaceContext } from "@/components/space/space-context";
import { SpaceEndModal, SpaceStartModal } from "@/components/space/space-status-modals";
import { SpaceVisibilityModal } from "@/components/space/space-visibility-modal";
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { usePopup } from "@/lib/popup";
import type { ActivePanel } from "../page";

// app/ratel/src/features/spaces/pages/index/arena_topbar/component.rs (`ArenaTopbar`).

export function ArenaTopbar({
  logo,
  title,
  statusText,
  activePanel,
  setActivePanel,
}: {
  logo: string;
  title: string;
  statusText: string;
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
}) {
  const tr = useSpaceViewerI18n();
  const ctx = useSpaceContext();
  const popup = usePopup();
  const navigate = useNavigate();
  const updateSpace = useUpdateSpace();
  const likePost = useLikePost();
  const isAdmin = isSpaceAdmin(ctx.role);
  const hasUser = useUserContext().user !== null;
  const isPublished = ctx.space.publish_state === SpacePublishState.Published;
  const isInProgress = ctx.space.status === SpaceStatus.Open;
  const isStarted = ctx.space.status === SpaceStatus.Ongoing;
  const spaceId = ctx.space.id;
  const overviewOpen = activePanel === "Overview";
  const leaderboardOpen = activePanel === "Leaderboard";
  const settingsOpen = activePanel === "Settings";
  const [isLikeProcessing, setIsLikeProcessing] = React.useState(false);
  const spaceLiked = ctx.space.liked;
  const spaceLikes = ctx.space.likes;
  const spacePostId = ctx.space.post_id;

  const toggle = (panel: ActivePanel) => setActivePanel(activePanel === panel ? "None" : panel);

  return (
    <div className="arena-topbar">
      <div className="arena-topbar__brand">
        <img className="arena-topbar__logo" src={logo} alt="Space logo" />
        <span className="arena-topbar__title">{title}</span>
        <span className="arena-topbar__status">{statusText}</span>
        {isAdmin && (
          <span className="arena-topbar__role" data-testid="arena-topbar-admin-badge">
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
            </svg>
            {tr.adminBadge}
          </span>
        )}
      </div>
      <div className="arena-topbar__actions">
        <button aria-label={tr.home} className="hud-btn" data-testid="btn-home" onClick={() => navigate("/")}>
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="tooltip">{tr.home}</span>
        </button>
        {hasUser && <NotificationBell className="hud-btn" onClick={() => toggle("Notifications")} />}
        {isAdmin &&
          (!isPublished ? (
            <button
              aria-label={tr.publish}
              className="hud-btn hud-btn--publish"
              data-testid="btn-publish"
              onClick={() => {
                popup.open(
                  <SpaceVisibilityModal
                    initial={ctx.space.visibility}
                    onConfirm={(visibility) => {
                      void (async () => {
                        // Rust ignores the result of `update_space` here.
                        await updateSpace
                          .mutateAsync({ spaceId, req: { publish: true, visibility } })
                          .catch((e) => console.error("publish space failed:", e));
                        await ctx.restartSpace();
                      })();
                    }}
                  />,
                );
              }}
            >
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M4 12 L20 4 L16 12 L20 20 Z" />
              </svg>
              <span className="tooltip">{tr.publish}</span>
            </button>
          ) : isInProgress ? (
            <button
              aria-label={tr.start}
              className="hud-btn hud-btn--publish"
              data-testid="btn-start"
              onClick={() => {
                popup.open(<SpaceStartModal spaceId={spaceId} onSuccess={() => void ctx.restartSpace()} />);
              }}
            >
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              <span className="tooltip">{tr.start}</span>
            </button>
          ) : isStarted ? (
            <button
              aria-label={tr.finish}
              className="hud-btn hud-btn--publish"
              data-testid="btn-finish"
              onClick={() => {
                popup.open(<SpaceEndModal spaceId={spaceId} onSuccess={() => void ctx.restartSpace()} />);
              }}
            >
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span className="tooltip">{tr.finish}</span>
            </button>
          ) : null)}
        <button
          aria-label={tr.likes}
          aria-pressed={dataBool(spaceLiked)}
          className="hud-btn hud-btn--like"
          data-testid="btn-space-like"
          disabled={isLikeProcessing}
          onClick={() => {
            if (isLikeProcessing) return;
            setIsLikeProcessing(true);
            void (async () => {
              try {
                await likePost.mutateAsync({ postId: spacePostId, like: !spaceLiked });
              } catch (e) {
                console.error("space like toggle failed:", e);
              }
              await ctx.restartSpace();
              setIsLikeProcessing(false);
            })();
          }}
        >
          <svg
            fill={spaceLiked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M7 10v12" />
            <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
          </svg>
          {spaceLikes > 0 && <span className="hud-btn__count">{spaceLikes}</span>}
          <span className="tooltip">{tr.likes}</span>
        </button>
        <button
          aria-label={tr.overview}
          aria-pressed={dataBool(overviewOpen)}
          className="hud-btn"
          data-testid="btn-overview"
          onClick={() => toggle("Overview")}
        >
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
            <line x1="10" x2="8" y1="9" y2="9" />
          </svg>
          <span className="tooltip">{tr.overview}</span>
        </button>
        <button
          aria-label={tr.leaderboard}
          aria-pressed={dataBool(leaderboardOpen)}
          className="hud-btn"
          data-testid="btn-leaderboard"
          onClick={() => toggle("Leaderboard")}
        >
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
            <path d="M11 12 5.12 2.2" />
            <path d="m13 12 5.88-9.8" />
            <path d="M8 7h8" />
            <circle cx="12" cy="17" r="5" />
            <path d="M12 18v-2h-.5" />
          </svg>
          <span className="tooltip">{tr.leaderboard}</span>
        </button>
        <button
          aria-label={tr.settings}
          aria-pressed={dataBool(settingsOpen)}
          className="hud-btn"
          data-testid="btn-settings"
          onClick={() => toggle("Settings")}
        >
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="tooltip">{tr.settings}</span>
        </button>
      </div>
    </div>
  );
}
