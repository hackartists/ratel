import { useState } from "react";
import { LevelChip } from "@/components/character/level-chip";
import { AlignJustify } from "@/components/icons/alignments";
import { Edit1 } from "@/components/icons/edit";
import { LayoutGrid } from "@/components/icons/lucide";
import { useUserHomeI18n } from "@/i18n/generated/features/social/user_views/home/user-home.i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { TeamHeader } from "./team-header";
import { useCreateUserPost, useFollowControls, useUserProfile } from "./use-user-home";
import { UserPostsPanel, type HomeViewMode } from "./user-posts-panel";

// app/ratel/src/features/social/user_views/home/mod.rs (`Home`): the user wall
// home — profile header with follow button and level chip, the list/card view
// toggle, the owner's "Create" button and the user's posts.

export function UserHome({ username }: { username: string }) {
  // Rust seeds `is_following` / `view_mode` once per mount; keying by the
  // username keeps that state from leaking between walls.
  return <UserHomeView key={username} username={username} />;
}

function UserHomeView({ username }: { username: string }) {
  const tr = useUserHomeI18n();
  const [viewMode, setViewMode] = useState<HomeViewMode>("list");
  const { user } = useUserContext();
  const loggedIn = user !== null;
  const isOwner = user !== null && user.username === username;

  const profile = useUserProfile(username);
  const follow = useFollowControls(username);
  const createPost = useCreateUserPost();

  return (
    <div className="flex flex-col gap-6 w-full">
      <TeamHeader
        displayName={profile.displayName}
        profileUrl={profile.profileUrl}
        description={profile.description}
        thumbnailUrl=""
        isCreator={false}
        settingsRoute=""
        isFollowing={follow.isFollowing}
        processing={follow.processing}
        loggedIn={loggedIn}
        rightSlot={<LevelChip username={username} />}
        onFollow={follow.follow}
        onUnfollow={follow.unfollow}
      />

      <div className="flex justify-between items-center w-full">
        <div className="flex overflow-hidden rounded-[10px] w-fit">
          <button
            className="flex justify-center items-center transition-colors cursor-pointer w-[60px] h-[44px] bg-button-muted aria-selected:bg-button-active hover:bg-button-muted-hover"
            aria-selected={dataBool(viewMode === "list")}
            onClick={() => setViewMode("list")}
          >
            <AlignJustify className="w-6 h-6 [&>path]:stroke-icon-primary" />
          </button>
          <button
            className="flex justify-center items-center transition-colors cursor-pointer w-[60px] h-[44px] bg-button-muted aria-selected:bg-button-active hover:bg-button-muted-hover"
            aria-selected={dataBool(viewMode === "card")}
            onClick={() => setViewMode("card")}
          >
            <LayoutGrid className="w-6 h-6 [&>rect]:stroke-icon-primary [&>path]:stroke-icon-primary" />
          </button>
        </div>

        {isOwner ? (
          <button
            className="flex gap-2.5 items-center py-3 px-5 text-sm font-medium rounded-full transition-colors cursor-pointer bg-btn-secondary-bg text-btn-secondary-text h-[44px] hover:bg-btn-secondary-hover-bg"
            onClick={() => void createPost()}
          >
            <Edit1 className="w-4 h-4 [&>path]:stroke-neutral-900 light:[&>path]:stroke-white" />
            <span>{tr.create}</span>
          </button>
        ) : null}
      </div>

      <UserPostsPanel key={`posts-${username}`} username={username} viewMode={viewMode} />
    </div>
  );
}
