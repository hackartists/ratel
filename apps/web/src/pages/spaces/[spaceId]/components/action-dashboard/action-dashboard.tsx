// app/ratel/src/features/spaces/pages/index/action_dashboard/component.rs —
// `ActionDashboard` (participant/creator quest carousel, bottom bar, archive
// panel), `ArchiveItem`, `derive_action_status`, `quest_type_css`.
// app/ratel/src/features/spaces/pages/index/action_dashboard/script.js is loaded
// unmodified: it owns the carousel `.active` classes, arrow/dot clicks and the
// fly-to-archive animation driven by `data-archive-action` on the track.
//
// Renders siblings (no wrapper), like the Rust fragment.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SpaceActionSummary, SpaceActionType, SpacePartition } from "@ratel/ts-bridges";
import { useActionOverlay, useCompletedActionCard } from "@/components/space/action-overlay";
import { EntityPrefix, subPartitionId, useCreateSpaceAction } from "@/components/space/create-space-action";
import { useSpaceContext } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useSpaceViewerI18n } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";
import { dataBool } from "@/lib/dom";
import { useLegacyScript } from "@/lib/legacy-scripts";
import { useToast } from "@/lib/toast";
import { useDismissOnOutsideSelector } from "@/lib/use-dismiss-on-outside-selector";
import actionDashboardScript from "../../../../../legacy-scripts/features/spaces/pages/index/action_dashboard/script.js?url&no-inline";
import { AddActionCard } from "./add-action-card";
import { buildActionLookup, resolveDependencyLock } from "./dependency-lock";
import { DiscussionActionCard } from "./discussion-card";
import { FollowActionCard } from "./follow-card";
import { MeetActionCard } from "./meet-action-card";
import { PollActionCard } from "./poll-card";
import { QuizActionCard } from "./quiz-card";
import { TypePickerModal } from "./type-picker-modal";

export type ActionStatus = "Active" | "Completed" | "Skipped";

/** Rust `derive_action_status`. */
export function deriveActionStatus(action: SpaceActionSummary): ActionStatus {
  const ended = action.status === "Finish";

  switch (action.action_type) {
    case "Poll":
      if (action.user_participated) return "Completed";
      if (ended) return "Skipped";
      return "Active";
    case "TopicDiscussion":
      if (ended && action.user_participated) return "Completed";
      if (ended) return "Skipped";
      return "Active";
    case "Quiz":
      // Any attempt — passing or failing — counts as "completed" so
      // the quiz moves into the archive where the user can review
      // their score. The archive row itself distinguishes passed
      // vs. failed-with-retries-left via a score badge.
      if (action.user_participated) return "Completed";
      if (ended) return "Skipped";
      return "Active";
    case "Follow":
      if (action.user_participated) return "Completed";
      if (ended) return "Skipped";
      return "Active";
    case "Meet":
      if (action.user_participated) return "Completed";
      if (ended) return "Skipped";
      return "Active";
  }
}

export function ActionDashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  useLegacyScript(actionDashboardScript);

  const tr = useSpaceViewerI18n();
  const spaceCtx = useSpaceContext();
  const spaceId = spaceCtx.spaceId;
  const actions = spaceCtx.actions;
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const createSpaceAction = useCreateSpaceAction();

  const lookup = buildActionLookup(actions);
  const active = actions.filter((a) => deriveActionStatus(a) === "Active");
  const completed = actions.filter((a) => deriveActionStatus(a) === "Completed");
  const skipped = actions.filter((a) => deriveActionStatus(a) === "Skipped");

  const total = actions.length;
  const done = completed.length;
  const skippedCount = skipped.length;
  const progressPct = total > 0 ? Math.trunc((done / total) * 100.0) : 0;

  const [showArchive, setShowArchive] = useState(false);
  // Press anywhere outside the panel closes it. Two selectors because the
  // trigger is not inside the panel — it lives in the bottom bar, and a
  // press on it must reach its own toggle rather than be read as "outside".
  useDismissOnOutsideSelector(".archive-panel, .archive-btn", () => setShowArchive(false));
  const { completed: archiveActionId, setCompleted } = useCompletedActionCard();

  // The spawned task is tied to the component (Rust scope), not to the effect run.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const latestCtx = useRef(spaceCtx);
  latestCtx.current = spaceCtx;

  // After fly animation: clear signal and refresh the actions list
  useEffect(() => {
    if (archiveActionId === null) return;
    void (async () => {
      await new Promise((r) => setTimeout(r, 1500));
      if (!mounted.current) return;
      setCompleted(null);
      void latestCtx.current.restartActions();
    })();
  }, [archiveActionId, setCompleted]);

  const onPick = async (ty: SpaceActionType) => {
    setTypePickerOpen(false);
    try {
      const route = await createSpaceAction(ty, spaceId);
      spaceCtx.setCurrentRole("Creator");
      // Refresh the actions list so the newly-created
      // action appears when the user returns to the
      // dashboard from the editor.
      void spaceCtx.restartActions();
      navigate(route);
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <div className="quest-label" data-testid="quest-label">
        <span className="quest-label__title">{tr.yourQuests}</span>
        <span className="quest-label__info" aria-label={tr.yourQuestsTooltip}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span className="quest-label__info-tip">{tr.yourQuestsTooltip}</span>
        </span>
      </div>

      {active.length === 0 && !isAdmin ? (
        <div className="quest-empty">
          <div className="quest-empty__icon">
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="quest-empty__text">{tr.allQuestsDone}</div>
        </div>
      ) : (
        <>
          <div className="carousel-wrapper">
            <button className="carousel-arrow carousel-arrow--prev" data-testid="carousel-prev" aria-label={tr.prevQuest}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button className="carousel-arrow carousel-arrow--next" data-testid="carousel-next" aria-label={tr.nextQuest}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <div className="carousel-track" id="carousel-track" data-archive-action={archiveActionId ?? ""}>
              {active.map((action) => {
                const key = action.action_id;
                const lock = resolveDependencyLock(action, lookup);
                switch (action.action_type) {
                  case "Poll":
                    return <PollActionCard key={key} action={action} isAdmin={isAdmin} lock={lock} />;
                  case "TopicDiscussion":
                    return <DiscussionActionCard key={key} action={action} isAdmin={isAdmin} lock={lock} />;
                  case "Quiz":
                    return <QuizActionCard key={key} action={action} isAdmin={isAdmin} lock={lock} />;
                  case "Follow":
                    return <FollowActionCard key={key} action={action} isAdmin={isAdmin} lock={lock} />;
                  case "Meet":
                    return <MeetActionCard key={key} action={action} isAdmin={isAdmin} />;
                }
              })}
              {isAdmin && <AddActionCard onClick={() => setTypePickerOpen(true)} />}
            </div>
          </div>

          <div className="carousel-dots" id="carousel-dots">
            {active.map((action) => (
              <button key={action.action_id} className="carousel-dot" data-type={questTypeCss(action.action_type)} />
            ))}
            {isAdmin && <button className="carousel-dot" data-type="add" />}
          </div>
        </>
      )}

      {/* Type picker modal (admin only) */}
      {isAdmin && (
        <TypePickerModal
          open={typePickerOpen}
          onClose={() => setTypePickerOpen(false)}
          onPick={(ty) => void onPick(ty)}
        />
      )}

      {/* Bottom bar */}
      <div className="bottom-bar">
        <div className="quest-progress">
          <span className="quest-progress__label">{tr.questProgress}</span>
          <div className="quest-progress__bar-wrap">
            <div className="quest-progress__bar" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="quest-progress__fraction">{`${done} / ${total}`}</span>
        </div>

        <button
          className="archive-btn"
          data-testid="btn-archive"
          aria-label="Completed quests"
          onClick={() => setShowArchive((open) => !open)}
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
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          {done + skippedCount > 0 && <span className="archive-btn__count">{`${done + skippedCount}`}</span>}
        </button>
      </div>

      {/* Archive panel */}
      <div className="archive-panel" data-open={dataBool(showArchive)} data-testid="archive-panel">
        <div className="archive-panel__header">
          <span className="archive-panel__title">{tr.completed}</span>
          <button className="archive-panel__close" onClick={() => setShowArchive(false)}>
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="archive-panel__list">
          {completed.length === 0 && skipped.length === 0 ? (
            <div className="archive-panel__empty">{tr.noCompletedYet}</div>
          ) : (
            <>
              {completed.map((action) => (
                <ArchiveItem key={`c-${action.action_id}`} action={action} status="Completed" spaceId={spaceId} />
              ))}
              {skipped.map((action) => (
                <ArchiveItem key={`s-${action.action_id}`} action={action} status="Skipped" spaceId={spaceId} />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ArchiveItem({
  action,
  status,
  spaceId,
}: {
  action: SpaceActionSummary;
  status: ActionStatus;
  spaceId: SpacePartition;
}) {
  const te = useEnumI18n();
  const tr = useSpaceViewerI18n();
  const isCompleted = status === "Completed";
  // Completed actions reopen their overlay on click so participants can
  // revisit their entry. Skipped quizzes are also clickable in read-only
  // mode — the submit button inside the overlay stays disabled because
  // `can_submit` checks `attempt_count < total_allowed && !has_passed`.
  // Skipped discussions are likewise clickable so users can read the
  // thread after it ended; `can_comment` inside the overlay already
  // disables posting for viewers or ended discussions.
  const canReopen =
    isCompleted ||
    (status === "Skipped" &&
      (action.action_type === "Quiz" || action.action_type === "TopicDiscussion" || action.action_type === "Poll"));
  const { setOverlay } = useActionOverlay();
  const navigate = useNavigate();

  const isQuiz = action.action_type === "Quiz";
  const quizPassed = action.quiz_passed === true;

  return (
    <div
      className="archive-item"
      style={canReopen ? { cursor: "pointer" } : undefined}
      onClick={() => {
        if (!canReopen) return;
        const sid = spaceId;
        const aid = action.action_id;
        switch (action.action_type) {
          case "Poll":
            setOverlay({ kind: "Poll", spaceId: sid, pollId: subPartitionId(aid, EntityPrefix.SpacePoll) });
            break;
          case "Quiz":
            setOverlay({ kind: "Quiz", spaceId: sid, quizId: subPartitionId(aid, EntityPrefix.SpaceQuiz) });
            break;
          case "TopicDiscussion":
            navigate(`/spaces/${sid}/discussions/${subPartitionId(aid, EntityPrefix.SpacePost)}`);
            break;
          case "Follow": // Follow has no in-overlay detail view yet; skip.
          case "Meet": // Meet has no in-overlay detail view yet; skip.
            break;
        }
      }}
    >
      <div className="archive-item__info">
        <div className="archive-item__title">{action.title}</div>
        <div className="archive-item__meta">{`${te("SpaceActionType", action.action_type)} · ${action.credits} CR`}</div>
      </div>
      {isQuiz && isCompleted && !quizPassed ? (
        // Failed attempt — show the score (e.g. "1 / 4").
        <div className="archive-item__score">{`${action.quiz_score ?? 0} / ${action.quiz_total_score ?? 0}`}</div>
      ) : isCompleted ? (
        <div className="archive-item__check">
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
      ) : (
        <div className="archive-item__skipped">{tr.skippedLabel}</div>
      )}
    </div>
  );
}

/** Rust `quest_type_css`. */
function questTypeCss(t: SpaceActionType): string {
  switch (t) {
    case "Poll":
      return "poll";
    case "TopicDiscussion":
      return "discuss";
    case "Quiz":
      return "quiz";
    case "Follow":
      return "follow";
    case "Meet":
      return "meet";
  }
}
