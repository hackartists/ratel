// app/ratel/src/features/spaces/pages/index/action_dashboard/quiz_card/component.rs —
// `QuizActionCard`: quest card for a quiz; opens the quiz arena overlay (or the
// locked-dependencies popup).
import { useNavigate } from "react-router-dom";
import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { useActionOverlay } from "@/components/space/action-overlay";
import { EntityPrefix, subPartitionId } from "@/components/space/create-space-action";
import { useSpaceContext } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useSpaceViewerI18n } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";
import { dataBool } from "@/lib/dom";
import { usePopup } from "@/lib/popup";
import { type DependencyLock, dependencyLockNone, openLockedPopup, resolveOutstandingActions } from "./dependency-lock";
import { QuestEditButton } from "./quest-edit-button";

export function QuizActionCard({
  action,
  isAdmin = false,
  lock = dependencyLockNone(),
}: {
  action: SpaceActionSummary;
  isAdmin?: boolean;
  lock?: DependencyLock;
}) {
  const tr = useSpaceViewerI18n();
  const te = useEnumI18n();
  const { setOverlay } = useActionOverlay();
  const navigate = useNavigate();
  const spaceCtx = useSpaceContext();
  const spaceId = spaceCtx.spaceId;
  const popup = usePopup();
  const locked = lock.locked;
  const outstanding = resolveOutstandingActions(action, spaceCtx.actions);

  return (
    <div
      className="quest-card quest-card--quiz"
      data-type="quiz"
      data-prerequisite={dataBool(action.prerequisite)}
      data-locked={dataBool(locked)}
      data-testid={`quest-card-${action.action_id}`}
      data-credits={`${action.credits}`}
      onClick={() => {
        if (locked) {
          openLockedPopup(popup, spaceId, outstanding);
          return;
        }
        setOverlay({ kind: "Quiz", spaceId, quizId: subPartitionId(action.action_id, EntityPrefix.SpaceQuiz) });
      }}
    >
      <svg
        className="quest-card__hero"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" x2="12.01" y1="17" y2="17" />
      </svg>

      <div className="quest-card__top">
        <span className="quest-card__type quest-card__type--quiz">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          {te("SpaceActionType", action.action_type)}
        </span>
        <div className="quest-card__top-actions">
          {locked && <span className="quest-card__badge quest-card__badge--locked">{tr.lockedLabel}</span>}
          {action.prerequisite && (
            <span className="quest-card__badge quest-card__badge--prerequisite">{tr.requiredLabel}</span>
          )}
          {action.credits > 0 && (
            <span className="quest-card__badge quest-card__badge--credits">{`+${action.credits} CR`}</span>
          )}
          {isAdmin && (
            <QuestEditButton
              actionId={action.action_id}
              onEdit={() => {
                spaceCtx.setCurrentRole("Creator");
                const quizId = subPartitionId(action.action_id, EntityPrefix.SpaceQuiz);
                navigate(`/spaces/${spaceId}/actions/quizzes/${quizId}`);
              }}
            />
          )}
        </div>
      </div>

      <div className="quest-card__body">
        <div className="quest-card__title">{action.title}</div>
        {action.description !== "" && (
          <div className="quest-card__desc" dangerouslySetInnerHTML={{ __html: action.description }} />
        )}
        <div className="quest-card__detail">
          <div className="quest-quiz-stats">
            {action.quiz_total_score !== null && (
              <div className="quest-quiz-stat">
                <span className="quest-quiz-stat__value">{`${action.quiz_total_score}`}</span>
                <span className="quest-quiz-stat__label">{tr.questions}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="quest-card__footer">
        <div className="quest-card__reward">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12" />
            <path d="M16 10H8" />
          </svg>
          {`${action.credits} CR`}
        </div>
        {locked ? (
          <button className="quest-card__cta quest-card__cta--locked">{tr.lockedSeeRequired}</button>
        ) : (
          <button className="quest-card__cta quest-card__cta--start">{tr.startQuest}</button>
        )}
      </div>
    </div>
  );
}
