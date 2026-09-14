import * as React from "react";
import { Suspense } from "react";
import { InboxProvider } from "@/components/notifications/inbox";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { ActionOverlayProvider, useActionOverlay } from "@/components/space/action-overlay";
import { DiscussionArenaPage } from "@/components/space/discussion-arena/discussion-arena";
import { SettingsPanel } from "@/components/space/settings-panel/settings-panel";
import { isSpaceAdmin, SpaceStatus, useSpaceContext } from "@/components/space/space-context";
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";
import { useUserContext } from "@/lib/auth";
import { useDismissOnOutsideSelector } from "@/lib/use-dismiss-on-outside-selector";
import { ActionDashboard } from "./components/action-dashboard/action-dashboard";
import { ArenaTopbar } from "./components/arena-topbar";
import { ArenaViewer } from "./components/arena-viewer";
import { CandidateView } from "./components/candidate-view";
import { DEFAULT_LOGO, formatNumber } from "./components/format";
import { LeaderboardPanel } from "./components/leaderboard-panel";
import { OverviewPanel } from "./components/overview-panel";
import { ActionPollViewer } from "./components/poll-viewer/poll-viewer";
import { QuizArenaPage } from "./components/quiz-arena/quiz-arena";

// app/ratel/src/features/spaces/pages/index/component.rs (`SpaceIndexPage`, `/spaces/:spaceId`).
// Page-scoped providers render no DOM: the action overlay + completed-card
// contexts, and the space-scoped notification inbox/unread count
// (`use_provide_space_unread_count` + `use_provide_space_inbox`).

/** Rust `ActivePanel`. */
export type ActivePanel = "None" | "Overview" | "Leaderboard" | "Settings" | "Notifications";

export function Component() {
  const { spaceId } = useSpaceContext();
  return (
    <ActionOverlayProvider>
      <InboxProvider spaceId={spaceId}>
        <SpaceIndexPage />
      </InboxProvider>
    </ActionOverlayProvider>
  );
}

function SpaceIndexPage() {
  const tr = useSpaceViewerI18n();
  const ctx = useSpaceContext();
  const space = ctx.space;
  const role = ctx.currentRole;
  const hasUser = useUserContext().user !== null;
  const [activePanel, setActivePanel] = React.useState<ActivePanel>("None");
  const { overlay } = useActionOverlay();

  // One registration covers every panel; `.arena-topbar` is included so the
  // header buttons keep owning their own toggle.
  const activeRef = React.useRef(activePanel);
  activeRef.current = activePanel;
  useDismissOnOutsideSelector(
    ".overview-panel, .leaderboard-panel, .settings-panel, .notification-panel, .arena-topbar",
    () => {
      if (activeRef.current !== "None") setActivePanel("None");
    },
  );

  const isAdmin = isSpaceAdmin(ctx.role);
  const logo = space.logo === "" ? DEFAULT_LOGO : space.logo;
  const statusText =
    space.status === SpaceStatus.Ongoing
      ? tr.statusOngoing
      : space.status === SpaceStatus.Finished
        ? tr.statusFinished
        : tr.statusOpen;
  const remaining = formatNumber(space.remains);
  const rewards = space.rewards !== null ? formatNumber(space.rewards) : "0";

  const dimmed = activePanel !== "None";
  const close = () => setActivePanel("None");

  return (
    <>
      <div className="arena" data-testid="space-index-page">
        <ArenaTopbar
          logo={logo}
          title={space.title}
          statusText={statusText}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
        />

        {role === "Participant" || role === "Creator" ? (
          <Suspense fallback={null}>
            <ActionDashboard isAdmin={isAdmin} />
          </Suspense>
        ) : role === "Candidate" ? (
          <ArenaViewer
            dimmed={dimmed}
            candidateView={
              <Suspense fallback={null}>
                <CandidateView />
              </Suspense>
            }
          />
        ) : (
          <ArenaViewer dimmed={dimmed} />
        )}

        <Suspense fallback={null}>
          <OverviewPanel
            open={activePanel === "Overview"}
            onClose={close}
            remaining={remaining}
            rewards={rewards}
            isAdmin={isAdmin}
          />
        </Suspense>

        <LeaderboardPanel open={activePanel === "Leaderboard"} onClose={close} />

        <SettingsPanel open={activePanel === "Settings"} onClose={close} isAdmin={isAdmin} spaceId={ctx.spaceId} />

        {hasUser && (
          <Suspense fallback={null}>
            <NotificationPanel open={activePanel === "Notifications"} onClose={close} />
          </Suspense>
        )}
      </div>
      {overlay?.kind === "Quiz" && (
        <div className="fixed inset-0 z-[100]" data-testid="quiz-arena-overlay">
          <Suspense fallback={null}>
            <QuizArenaPage spaceId={overlay.spaceId} quizId={overlay.quizId} />
          </Suspense>
        </div>
      )}
      {overlay?.kind === "Poll" && (
        <div className="fixed inset-0 z-[100]" data-testid="poll-arena-overlay">
          <Suspense fallback={null}>
            <ActionPollViewer spaceId={overlay.spaceId} pollId={overlay.pollId} canRespond />
          </Suspense>
        </div>
      )}
      {overlay?.kind === "Discussion" && (
        <div className="fixed inset-0 z-[100]">
          <Suspense fallback={null}>
            <DiscussionArenaPage spaceId={overlay.spaceId} discussionId={overlay.discussionId} />
          </Suspense>
        </div>
      )}
    </>
  );
}
