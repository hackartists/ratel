// app/ratel/src/features/spaces/pages/index/action_dashboard/poll_card/component.rs —
// `PollActionCard`: quest card for a poll; opens the poll overlay (or the
// locked-dependencies popup) without previewing any question before the survey starts.
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

export function PollActionCard({
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
  const navigate = useNavigate();
  const { setOverlay } = useActionOverlay();
  const spaceCtx = useSpaceContext();
  const spaceId = spaceCtx.spaceId;
  const popup = usePopup();
  const locked = lock.locked;
  const outstanding = resolveOutstandingActions(action, spaceCtx.actions);

  const pollId = subPartitionId(action.action_id, EntityPrefix.SpacePoll);

  return (
    <div
      className="quest-card quest-card--poll"
      data-type="poll"
      data-prerequisite={dataBool(action.prerequisite)}
      data-locked={dataBool(locked)}
      data-testid={`quest-card-${action.action_id}`}
      onClick={() => {
        if (locked) {
          openLockedPopup(popup, spaceId, outstanding);
          return;
        }
        setOverlay({ kind: "Poll", spaceId, pollId: subPartitionId(action.action_id, EntityPrefix.SpacePoll) });
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
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>

      <div className="quest-card__top">
        <span className="quest-card__type quest-card__type--poll">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
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
                navigate(`/spaces/${spaceId}/actions/polls/${pollId}`);
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
          <button className="quest-card__cta quest-card__cta--start">{tr.voteLabel}</button>
        )}
      </div>
    </div>
  );
}
