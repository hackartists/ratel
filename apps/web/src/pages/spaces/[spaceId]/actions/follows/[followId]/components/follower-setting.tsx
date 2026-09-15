import { useFollowUserPostApiMyFollowerFollow, useUnfollowUserDeleteApiMyFollowerFollow } from "@ratel/ts-bridges/hooks";
import { InfiniteMore } from "@/components/space-actions/infinite-more";
import { useFollowUserListI18n } from "./follow-user-list.i18n";
import { useToast } from "@/lib/toast";
import { useFollowUsers } from "../hooks/use-follow-users";
import { FollowUserInvite } from "./follow-user-invite";
import { FollowUserList } from "./follow-user-list";

// follow/views/main/creator/follower_setting.rs — invite box + target list.
// Subscribing here goes through the creator's own follower graph
// (`my_follower::follow_user` / `unfollow_user`).
export function FollowerSetting({ spaceId }: { spaceId: string }) {
  const tr = useFollowUserListI18n();
  const toast = useToast();
  const list = useFollowUsers(spaceId);
  const follow = useFollowUserPostApiMyFollowerFollow();
  const unfollow = useUnfollowUserDeleteApiMyFollowerFollow();

  // The Rust infinite query suspends until the first page loads.
  if (list.pending) return null;

  const moreElement = <InfiniteMore hasMore={list.hasMore} isLoading={list.isLoadingMore} onLoadMore={list.loadMore} />;

  return (
    <div className="flex flex-col gap-4 w-full">
      <FollowUserInvite spaceId={spaceId} onRefresh={list.refresh} />

      <FollowUserList
        spaceId={spaceId}
        users={list.users}
        canDelete
        onRefresh={list.refresh}
        onFollow={(targetPk) =>
          follow
            .mutateAsync(targetPk)
            .then(() => {
              toast.info(tr.subscribedToast);
              list.refresh();
            })
            .catch((err) => toast.error(err))
        }
        onUnfollow={(targetPk) =>
          unfollow
            .mutateAsync(targetPk)
            .then(() => {
              toast.info(tr.unsubscribedToast);
              list.refresh();
            })
            .catch((err) => toast.error(err))
        }
        moreElement={moreElement}
      />
    </div>
  );
}
