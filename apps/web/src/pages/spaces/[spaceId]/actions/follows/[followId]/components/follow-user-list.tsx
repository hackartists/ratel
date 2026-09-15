import type { ReactNode } from "react";
import { useDeleteFollowUser } from "@ratel/ts-bridges/hooks";
import { Button, ButtonStyle } from "@/components/ui/button";
import { SpaceCard } from "@/components/ui/space-card";
import { useFollowUserListI18n } from "./follow-user-list.i18n";
import type { FollowUserItem } from "../hooks/use-follow-users";

/** `UserType::Team`. */
const USER_TYPE_TEAM = 2;

// follow/components/follow_user_list — the creator's target list. The first
// entry is the space creator (badge, cannot be removed).
export function FollowUserList({
  spaceId,
  users,
  canDelete,
  onRefresh,
  onFollow,
  onUnfollow,
  moreElement,
}: {
  spaceId: string;
  users: FollowUserItem[];
  canDelete: boolean;
  onRefresh: () => void;
  onFollow: (targetPk: string) => void;
  onUnfollow: (targetPk: string) => void;
  moreElement: ReactNode;
}) {
  const tr = useFollowUserListI18n();
  const remove = useDeleteFollowUser();

  return (
    <SpaceCard className="overflow-visible w-full shrink-0 rounded-[12px] !p-0">
      <div className="flex justify-between items-center self-stretch px-5 py-4 border-b border-separator">
        <p className="font-semibold text-center sp-dash-font-raleway text-[17px]/[20px] tracking-[-0.18px] text-font-primary">
          {tr.title}
        </p>
      </div>
      <div className="flex flex-col items-start self-stretch p-5 gap-3 bg-card max-mobile:p-4">
        {users.length === 0 ? (
          <p className="font-medium leading-6 sp-dash-font-raleway text-[15px] tracking-[0.5px] text-card-meta">{tr.empty}</p>
        ) : (
          <>
            {users.map((user, idx) => {
              const isCreator = idx === 0;
              const subscribed = user.subscribed;
              const isTeam = user.user_type === USER_TYPE_TEAM;
              return (
                <SpaceCard
                  key={user.user_pk}
                  className="flex justify-between items-center w-full max-tablet:flex-col max-tablet:items-start max-tablet:gap-3 !rounded-[12px] !bg-card !px-4 !py-3"
                >
                  <div className="flex items-center gap-[10px]">
                    {user.profile_url !== "" ? (
                      <img
                        src={user.profile_url}
                        alt={user.display_name}
                        className={
                          isTeam ? "object-cover object-top w-8 h-8 rounded-[8px]" : "object-cover object-top w-8 h-8 rounded-full"
                        }
                      />
                    ) : (
                      <div className={isTeam ? "w-8 h-8 rounded-[8px] bg-neutral-600" : "w-8 h-8 rounded-full bg-neutral-600"} />
                    )}
                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex gap-2 items-center">
                        <p className="font-bold leading-5 sp-dash-font-raleway text-[17px] tracking-[-0.18px] text-font-primary">
                          {user.display_name}
                        </p>
                        {isCreator && (
                          <span className="text-[12px]/[16px] font-semibold px-2 py-0.5 rounded-full bg-btn-primary-bg text-btn-primary-text">
                            {tr.creatorBadge}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold leading-4 sp-dash-font-raleway text-[13px] tracking-[-0.14px] text-web-font-neutral">
                        {`@${user.username}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 max-tablet:w-full max-tablet:justify-end">
                    <Button
                      className="min-w-[110px]"
                      buttonStyle={subscribed ? ButtonStyle.Secondary : ButtonStyle.Primary}
                      onClick={() => (subscribed ? onUnfollow(user.user_pk) : onFollow(user.user_pk))}
                    >
                      {subscribed ? tr.unsubscribe : tr.subscribe}
                    </Button>
                    {canDelete && !isCreator && (
                      <Button
                        className="min-w-[90px]"
                        buttonStyle={ButtonStyle.Outline}
                        onClick={() => {
                          if (isCreator) return;
                          // Rust ignores the result and refreshes either way.
                          remove
                            .mutateAsync({ spaceId, userPk: user.user_pk })
                            .catch(() => undefined)
                            .finally(() => onRefresh());
                        }}
                      >
                        {tr.remove}
                      </Button>
                    )}
                  </div>
                </SpaceCard>
              );
            })}

            {moreElement}
          </>
        )}
      </div>
    </SpaceCard>
  );
}
