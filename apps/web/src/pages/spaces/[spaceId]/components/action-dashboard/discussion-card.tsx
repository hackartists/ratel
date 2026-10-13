// app/ratel/src/features/spaces/pages/index/action_dashboard/discussion_card/component.rs —
// `DiscussionActionCard`: quest card for a discussion; navigates to the
// standalone discussion page (or opens the locked-dependencies popup).
import { useNavigate } from "react-router-dom";
import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { EntityPrefix, subPartitionId } from "@/components/space/create-space-action";
import { useSpaceContext } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useSpaceViewerI18n } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";
import { dataBool } from "@/lib/dom";
import { usePopup } from "@/lib/popup";
import { type DependencyLock, dependencyLockNone, openLockedPopup, resolveOutstandingActions } from "./dependency-lock";
import { QuestEditButton } from "./quest-edit-button";
import { QuestCardDesc } from "./quest-card-desc";

export function DiscussionActionCard({
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
  const spaceCtx = useSpaceContext();
  const spaceId = spaceCtx.spaceId;
  const popup = usePopup();

  const actionId = action.action_id;
  const prerequisite = action.prerequisite;
  const locked = lock.locked;
  const outstanding = resolveOutstandingActions(action, spaceCtx.actions);

  return (
    <div
      className="quest-card quest-card--discuss"
      data-prerequisite={dataBool(prerequisite)}
      data-locked={dataBool(locked)}
      data-testid={`quest-card-${actionId}`}
      data-type="discuss"
      onClick={() => {
        if (locked) {
          openLockedPopup(popup, spaceId, outstanding);
          return;
        }
        const discussionId = subPartitionId(actionId, EntityPrefix.SpacePost);
        navigate(`/spaces/${spaceId}/discussions/${discussionId}`);
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>

      <div className="quest-card__top">
        <span className="quest-card__type quest-card__type--discussion">
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {te("SpaceActionType", action.action_type)}
        </span>
        <div className="quest-card__top-actions">
          {locked && <span className="quest-card__badge quest-card__badge--locked">{tr.lockedLabel}</span>}
          {prerequisite && <span className="quest-card__badge quest-card__badge--prerequisite">{tr.requiredLabel}</span>}
          {action.credits > 0 && (
            <span className="quest-card__badge quest-card__badge--credits">{`+${action.credits} CR`}</span>
          )}
          {isAdmin && (
            <QuestEditButton
              actionId={actionId}
              onEdit={() => {
                spaceCtx.setCurrentRole("Creator");
                const discussionId = subPartitionId(actionId, EntityPrefix.SpacePost);
                navigate(`/spaces/${spaceId}/actions/discussions/${discussionId}/edit`);
              }}
            />
          )}
        </div>
      </div>

      <div className="quest-card__body">
        <div className="quest-card__title">{action.title}</div>
        <QuestCardDesc html={action.description} />
        <div className="quest-card__detail">
          <div className="quest-detail-chip">
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {tr.joinDiscussion}
          </div>
          {action.comment_count !== null && (
            <div className="quest-detail-chip">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              {`${action.comment_count} ${tr.commentsCount}`}
            </div>
          )}
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
