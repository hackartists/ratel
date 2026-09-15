import type { ReactNode } from "react";
import { Plus } from "@/components/icons/lucide";
import { Button, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFollowListI18n } from "./follow-list.i18n";
import type { FollowUserItem, Partition } from "../hooks/use-my-follower";
import type { FollowTab } from "./follow-tabs";

// app/ratel/src/features/my_follower/components/follow_list.rs (`FollowList`).

/** `UserType::Team` (`#[repr(u8)]`, serialized as its number). */
const USER_TYPE_TEAM = 2;

const FOLLOW_BUTTON_CLASS =
  "w-fit h-fit px-[10px] py-[5px] rounded-[50px] items-center border border-neutral-700 hover:border-[#ff4d4f] hover:bg-[#ffe3e3] text-neutral-700";

const EMPTY_CLASS = "flex flex-row w-full h-fit justify-start items-center py-4 font-medium text-base text-gray-500";

export interface FollowListProps {
  users: FollowUserItem[];
  selected: FollowTab;
  loading: boolean;
  onFollow: (targetPk: Partition) => void;
  onUnfollow: (targetPk: Partition) => void;
  moreElement: ReactNode;
}

export function FollowList({ users, selected, loading, onFollow, onUnfollow, moreElement }: FollowListProps) {
  const tr = useFollowListI18n();

  return (
    <Card className="flex flex-col w-full px-4 py-5 gap-0">
      {users.length === 0 ? (
        <div className={EMPTY_CLASS}>{loading ? tr.loading : tr.empty}</div>
      ) : (
        <>
          <div className="flex flex-col">
            {users.map((user, idx) => {
              const isTeam = user.user_type === USER_TYPE_TEAM;
              const isLast = idx + 1 === users.length;
              const rowClass = isLast
                ? "flex flex-col w-full gap-[5px] py-5"
                : "flex flex-col w-full gap-[5px] py-5 border-b border-b-neutral-800 light:border-b-[#e5e5e5]";

              return (
                <div key={user.user_pk} className={rowClass}>
                  <div className="flex flex-row w-full justify-between items-start">
                    <div className="flex flex-row w-fit gap-2">
                      {user.profile_url !== "" ? (
                        <img
                          src={user.profile_url}
                          alt={user.display_name}
                          className={
                            isTeam
                              ? "w-8 h-8 rounded-lg object-cover object-top"
                              : "w-8 h-8 rounded-full object-cover object-top"
                          }
                        />
                      ) : (
                        <div
                          className={isTeam ? "w-8 h-8 rounded-lg bg-neutral-500" : "w-8 h-8 rounded-full bg-neutral-500"}
                        />
                      )}

                      <div className="flex flex-col">
                        <div className="font-semibold text-text-primary text-sm/[20px]">{user.display_name}</div>
                        <div className="font-medium text-neutral-500 text-[12px]">{`@${user.username}`}</div>
                      </div>
                    </div>

                    {selected === "Followers" ? (
                      !user.is_following && <FollowButton onClick={() => onFollow(user.user_pk)} />
                    ) : (
                      <UnfollowButton onClick={() => onUnfollow(user.user_pk)} />
                    )}
                  </div>

                  {user.description !== "" && (
                    <div className="font-medium text-[12px] text-neutral-300 light:text-text-primary">
                      {user.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {moreElement}
        </>
      )}
    </Card>
  );
}

function FollowButton({ onClick }: { onClick: () => void }) {
  const tr = useFollowListI18n();
  return (
    <Button size={ButtonSize.Small} buttonStyle={ButtonStyle.Outline} className={FOLLOW_BUTTON_CLASS} onClick={onClick}>
      <span className="inline-flex items-center gap-1 font-bold text-xs">
        <Plus size={14} className="[&>path]:stroke-[#000203] light:[&>path]:stroke-[#000203]" />
        {tr.follow}
      </span>
    </Button>
  );
}

function UnfollowButton({ onClick }: { onClick: () => void }) {
  const tr = useFollowListI18n();
  return (
    <Button size={ButtonSize.Small} buttonStyle={ButtonStyle.Outline} className={FOLLOW_BUTTON_CLASS} onClick={onClick}>
      <span className="font-bold text-xs">{tr.unfollow}</span>
    </Button>
  );
}
