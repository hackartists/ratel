// app/ratel/src/features/spaces/pages/index/action_dashboard/follow_card/component.rs —
// `FollowActionCard` + `FollowUserRow`: quest card listing the users to follow,
// each with an inline Follow button; following the last one flies the card into
// the archive (`CompletedActionCard`).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  FollowListFollowUsersFollowUserItem,
  SpaceActionFollowEntityType,
  SpaceActionSummary,
  SpacePartition,
} from "@ratel/ts-bridges";
import { useFollowUserPostApiSpacesFollowsUser } from "@ratel/ts-bridges/hooks";
import { useCompletedActionCard } from "@/components/space/action-overlay";
import { EntityPrefix, subPartitionId } from "@/components/space/create-space-action";
import { useSpaceContext } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";
import { dataBool } from "@/lib/dom";
import { usePopup } from "@/lib/popup";
import { type DependencyLock, dependencyLockNone, openLockedPopup, resolveOutstandingActions } from "./dependency-lock";
import { useFollowUsers } from "./hooks/use-follow-users";
import { QuestEditButton } from "./quest-edit-button";

const DEFAULT_PROFILE = "https://metadata.ratel.foundation/ratel/default-profile.png";

export function FollowActionCard({
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

  const followId = subPartitionId(action.action_id, EntityPrefix.SpaceActionFollow);
  const { followUsers, restart: restartFollowUsers } = useFollowUsers(spaceId);
  const users = followUsers.items;
  const total = users.length;
  const followedCount = users.filter((u) => u.subscribed).length;
  const { setCompleted } = useCompletedActionCard();
  const locked = lock.locked;
  const outstanding = resolveOutstandingActions(action, spaceCtx.actions);

  return (
    <div
      className="quest-card quest-card--follow"
      data-type="follow"
      data-prerequisite={dataBool(action.prerequisite)}
      data-locked={dataBool(locked)}
      data-testid={`quest-card-${action.action_id}`}
      data-credits={`${action.credits}`}
    >
      <svg
        className="quest-card__hero"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" x2="19" y1="8" y2="14" />
        <line x1="22" x2="16" y1="11" y2="11" />
      </svg>

      <div className="quest-card__top">
        <span className="quest-card__type quest-card__type--follow">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
          </svg>
          {te("SpaceActionType", action.action_type)}
        </span>
        <div className="quest-card__top-actions">
          {locked && <span className="quest-card__badge quest-card__badge--locked">{tr.lockedLabel}</span>}
          {action.prerequisite && (
            <span className="quest-card__badge quest-card__badge--prerequisite">{tr.requiredLabel}</span>
          )}
          {isAdmin && (
            <QuestEditButton
              actionId={action.action_id}
              onEdit={() => {
                spaceCtx.setCurrentRole("Creator");
                navigate(`/spaces/${spaceId}/actions/follows/${followId}`);
              }}
            />
          )}
        </div>
      </div>

      <div className="quest-card__body">
        <div className="quest-card__title">{action.title}</div>
        {locked && (
          <button
            type="button"
            className="quest-card__cta quest-card__cta--locked"
            onClick={() => openLockedPopup(popup, spaceId, outstanding)}
          >
            {tr.lockedSeeRequired}
          </button>
        )}
        <div className="quest-card__detail">
          <div className="quest-follow-list">
            {users.map((user) => {
              // After this follow, check if all are now followed
              const newFollowed = followedCount + 1;
              return (
                <FollowUserRow
                  key={user.user_pk}
                  user={user}
                  spaceId={spaceId}
                  followId={followId}
                  creditsPerFollow={total > 0 ? Math.floor(action.credits / total) : 0}
                  disabled={locked}
                  onFollowed={() => {
                    void restartFollowUsers();
                    if (newFollowed >= total) {
                      setCompleted(action.action_id);
                    }
                  }}
                />
              );
            })}
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
        <span className="quest-card__follow-count">{`${followedCount} / ${total} ${tr.followedLabel}`}</span>
      </div>
    </div>
  );
}

function FollowUserRow({
  user,
  spaceId,
  followId,
  creditsPerFollow,
  disabled = false,
  onFollowed,
}: {
  user: FollowListFollowUsersFollowUserItem;
  spaceId: SpacePartition;
  followId: SpaceActionFollowEntityType;
  creditsPerFollow: number;
  disabled?: boolean;
  onFollowed: () => void;
}) {
  const profile = user.profile_url === "" ? DEFAULT_PROFILE : user.profile_url;
  const bio = user.description === "" ? user.username : user.description;
  const displayName = user.display_name;
  const [showPoints, setShowPoints] = useState(false);
  const followUser = useFollowUserPostApiSpacesFollowsUser();

  return (
    <div className="quest-follow-user">
      <img className="quest-follow-user__avatar" src={profile} alt={displayName} />
      <div className="quest-follow-user__info">
        <div className="quest-follow-user__name">{displayName}</div>
        <div className="quest-follow-user__bio">{bio}</div>
      </div>
      {user.subscribed ? (
        <div className="quest-follow-user__btn-wrap">
          <button className="quest-follow-user__btn" data-followed="true">
            Following
          </button>
          {showPoints && <span className="points-anim">{`+${creditsPerFollow}`}</span>}
        </div>
      ) : (
        <button
          className="quest-follow-user__btn"
          disabled={disabled}
          onClick={async () => {
            if (disabled) return;
            // Rust `let _ = follow_user(..).await;` — the result is ignored.
            try {
              await followUser.mutateAsync({ spaceId, followId, targetPk: user.user_pk });
            } catch {
              // ignored, like the Rust `let _`
            }
            setShowPoints(true);
            onFollowed();
            await new Promise((r) => setTimeout(r, 1000));
            setShowPoints(false);
          }}
        >
          Follow
        </button>
      )}
    </div>
  );
}
