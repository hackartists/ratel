import { useFollowTabsI18n } from "./follow-tabs.i18n";

// app/ratel/src/features/my_follower/components/follow_tabs.rs (`FollowTabs`).

export type FollowTab = "Followers" | "Followings";

export function FollowTabs({ selected, onSelect }: { selected: FollowTab; onSelect: (tab: FollowTab) => void }) {
  const tr = useFollowTabsI18n();
  const followerClass =
    selected === "Followers"
      ? "cursor-pointer flex flex-col min-w-[110px] items-center text-text-primary text-[15px] font-semibold pb-2 border-b border-b-neutral-500 mr-8"
      : "cursor-pointer flex flex-col min-w-[110px] items-center text-text-secondary text-[15px] font-medium pb-2 border-none mr-8";
  const followingClass =
    selected === "Followings"
      ? "cursor-pointer flex flex-col min-w-[110px] items-center text-text-primary text-[15px] font-semibold pb-2 border-b border-b-neutral-500"
      : "cursor-pointer flex flex-col min-w-[110px] items-center text-text-secondary text-[15px] font-medium pb-2 border-none";

  return (
    <div className="flex flex-row w-full justify-center items-end gap-[20px]">
      <div className={followerClass} onClick={() => onSelect("Followers")}>
        {tr.followers}
      </div>
      <div className={followingClass} onClick={() => onSelect("Followings")}>
        {tr.followings}
      </div>
    </div>
  );
}
