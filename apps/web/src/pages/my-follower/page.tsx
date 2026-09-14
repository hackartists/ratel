import { useState } from "react";
import { MoreElement } from "@/components/ui/more-element";
import { useMyFollowerI18n } from "@/i18n/generated/features/my_follower/views/home/my-follower.i18n";
import { useToast } from "@/lib/toast";
import { FollowList } from "./components/follow-list";
import { FollowTabs, type FollowTab } from "./components/follow-tabs";
import { MyFollowerHeader } from "./components/my-follower-header";
import { useMyFollower, type FollowQuery, type Partition } from "./hooks/use-my-follower";

// app/ratel/src/features/my_follower/views/home/mod.rs (`MyFollowerPage`,
// `/my-follower`) — header, followers/followings tabs and the active list.
export function Component() {
  const tr = useMyFollowerI18n();
  const toast = useToast();
  const [selected, setSelected] = useState<FollowTab>("Followings");
  const { ready, followers, followings, follow, unfollow } = useMyFollower();

  // Both first pages suspend the page in Rust (SuspenseBoundary renders nothing).
  if (!ready) return null;

  const onFollow = async (targetPk: Partition) => {
    try {
      await follow(targetPk);
      toast.info(tr.followToast);
    } catch (err) {
      toast.error(err);
    }
  };

  const onUnfollow = async (targetPk: Partition) => {
    try {
      await unfollow(targetPk);
      toast.info(tr.unfollowToast);
    } catch (err) {
      toast.error(err);
    }
  };

  const list = (tab: FollowTab, query: FollowQuery) => (
    <FollowList
      key={tab}
      users={query.items}
      selected={tab}
      loading={query.loading}
      onFollow={(pk) => void onFollow(pk)}
      onUnfollow={(pk) => void onUnfollow(pk)}
      moreElement={<MoreElement hasMore={query.hasMore} loading={query.loading} onNext={query.next} />}
    />
  );

  return (
    <div className="flex flex-col gap-5 mx-auto w-full max-w-desktop max-tablet:px-2.5">
      <MyFollowerHeader />

      <FollowTabs selected={selected} onSelect={setSelected} />

      {selected === "Followers" ? list("Followers", followers) : list("Followings", followings)}
    </div>
  );
}
