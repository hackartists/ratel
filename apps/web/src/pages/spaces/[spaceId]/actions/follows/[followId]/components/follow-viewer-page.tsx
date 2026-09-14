import { useNavigate } from "react-router-dom";
import {
  useFollowUserPostApiSpacesFollowsUser,
  useUnfollowUserDeleteApiSpacesFollowsUser,
} from "@ratel/ts-bridges/hooks";
import { FullActionLayover } from "@/components/space-actions/full-action-layover";
import { InfiniteMore } from "@/components/space-actions/infinite-more";
import { useRefreshSpaceScores } from "@/components/space-actions/space-data";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { SpaceCard } from "@/components/ui/space-card";
import { useFollowFullCardI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/follow/components/follow_viewer_card/follow-full-card.i18n";
import { useFollowUserListI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/follow/components/follow_user_list/follow-user-list.i18n";
import { useFollowViewerI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/follow/views/main/viewer/follow-viewer.i18n";
import { useToast } from "@/lib/toast";
import { useFollowUsers, type FollowUserItem } from "../hooks/use-follow-users";

/** `UserType::Team`. */
const USER_TYPE_TEAM = 2;

// follow/views/main/viewer (`FollowViewerPage`) + components/follow_viewer_card.
// `FollowViewerCards` always renders the full card (`CardType::Full` is
// hard-coded in Rust; the small-card branch is unreachable).
export function FollowViewerPage({ spaceId, followId }: { spaceId: string; followId: string }) {
  const tr = useFollowViewerI18n();
  const listTr = useFollowUserListI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const refreshScores = useRefreshSpaceScores(spaceId); // space-context: space_ctx.ranking / my_score restart
  const list = useFollowUsers(spaceId);
  const follow = useFollowUserPostApiSpacesFollowsUser();
  const unfollow = useUnfollowUserDeleteApiSpacesFollowsUser();

  // The Rust infinite query suspends until the first page loads.
  if (list.pending) return null;

  const onFollow = (targetPk: string) =>
    follow
      .mutateAsync({ spaceId, followId, targetPk })
      .then(() => {
        toast.info(listTr.subscribedToast);
        list.refresh();
        refreshScores();
      })
      .catch((err) => toast.error(err));
  const onUnfollow = (targetPk: string) =>
    unfollow
      .mutateAsync({ spaceId, followId, targetPk })
      .then(() => {
        toast.info(listTr.unsubscribedToast);
        list.refresh();
        refreshScores();
      })
      .catch((err) => toast.error(err));

  return (
    <FullActionLayover
      contentClassName="gap-5"
      bottomRight={
        <Button
          buttonStyle={ButtonStyle.Outline}
          shape={ButtonShape.Square}
          className="min-w-[120px]"
          onClick={() => navigate(`/spaces/${spaceId}/actions`)}
        >
          {tr.btnBack}
        </Button>
      }
    >
      <div className="w-full">
        {list.users.length === 0 ? (
          <SpaceCard className="w-full rounded-[20px]! px-6! py-10!">
            <p className="text-sm font-medium text-foreground-muted">{listTr.empty}</p>
          </SpaceCard>
        ) : (
          <div className="flex w-full min-h-120 flex-col gap-3">
            <FollowFullCard
              users={list.users}
              onFollow={onFollow}
              onUnfollow={onUnfollow}
              moreElement={
                <InfiniteMore hasMore={list.hasMore} isLoading={list.isLoadingMore} onLoadMore={list.loadMore} />
              }
            />
          </div>
        )}
      </div>
    </FullActionLayover>
  );
}

function FollowFullCard({
  users,
  onFollow,
  onUnfollow,
  moreElement,
}: {
  users: FollowUserItem[];
  onFollow: (targetPk: string) => void;
  onUnfollow: (targetPk: string) => void;
  moreElement: React.ReactNode;
}) {
  const tr = useFollowFullCardI18n();
  const listTr = useFollowUserListI18n();

  return (
    <SpaceCard className="w-full overflow-hidden rounded-3xl! border border-separator bg-card! px-0! py-0!">
      <div className="flex flex-col">
        <div className="px-6 pt-6 pb-3 max-mobile:px-5">
          <h3 className="text-[32px]/[38px] font-extrabold tracking-[-0.03em] text-text-primary max-mobile:text-[26px]/[32px]">
            {tr.suggestedForYou}
          </h3>
        </div>

        <div className="flex flex-col">
          {users.map((user, idx) => {
            const isCreator = idx === 0;
            const isLast = idx + 1 === users.length;
            const isTeam = user.user_type === USER_TYPE_TEAM;
            const subscribed = user.subscribed;
            return (
              <div
                key={user.user_pk}
                className={
                  isLast
                    ? "flex items-start gap-4 px-6 py-4 max-mobile:px-5"
                    : "flex items-start gap-4 border-b border-separator px-6 py-4 max-mobile:px-5"
                }
              >
                <div
                  className={
                    isTeam
                      ? "h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-card"
                      : "h-14 w-14 shrink-0 overflow-hidden rounded-full bg-card"
                  }
                >
                  {user.profile_url !== "" ? (
                    <img src={user.profile_url} alt={user.display_name} className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="h-full w-full bg-input-box-border" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-[18px]/[22px] font-bold text-text-primary">{user.display_name}</p>
                        {isCreator && (
                          <span className="rounded-full border border-separator px-2 py-0.5 text-[11px]/[14px] font-semibold text-foreground-muted">
                            {tr.featuredProfile}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[16px]/[20px] font-medium text-foreground-muted">{`@${user.username}`}</p>
                    </div>
                    <Button
                      className="min-w-26 rounded-full!"
                      buttonStyle={subscribed ? ButtonStyle.Secondary : ButtonStyle.Primary}
                      onClick={() => (subscribed ? onUnfollow(user.user_pk) : onFollow(user.user_pk))}
                    >
                      {subscribed ? listTr.subscribed : listTr.subscribe}
                    </Button>
                  </div>

                  {user.description !== "" && <p className="text-[16px]/[22px] text-text-primary">{user.description}</p>}
                </div>
              </div>
            );
          })}

          {moreElement}
        </div>
      </div>
    </SpaceCard>
  );
}
