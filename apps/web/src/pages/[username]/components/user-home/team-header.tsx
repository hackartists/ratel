import * as React from "react";
import { Link } from "react-router-dom";
import { Settings } from "@/components/icons/lucide";

// app/ratel/src/features/social/user_views/home/team_header.rs (`TeamHeader`).

/** `TEAM_BANNER_DEFAULT` (common/assets.rs:4). */
const TEAM_BANNER_DEFAULT = "/assets/team-banner-default.png";

export interface TeamHeaderProps {
  displayName: string;
  profileUrl: string;
  description: string;
  thumbnailUrl: string;
  isCreator: boolean;
  settingsRoute: string;
  isFollowing: boolean;
  processing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  loggedIn: boolean;
  /** Chip / badge rendered on the right of the avatar + title row. */
  rightSlot?: React.ReactNode;
}

export function TeamHeader({
  displayName,
  profileUrl,
  description,
  thumbnailUrl,
  isCreator,
  settingsRoute,
  isFollowing,
  processing,
  onFollow,
  onUnfollow,
  loggedIn,
  rightSlot,
}: TeamHeaderProps) {
  return (
    <div className="w-full isolate">
      <div
        className="overflow-hidden relative z-0 w-full rounded-[10px] bg-card-bg"
        style={{ height: "180px", transform: "translateZ(0)" }}
      >
        <img src={thumbnailUrl !== "" ? thumbnailUrl : TEAM_BANNER_DEFAULT} alt="banner" className="object-cover w-full h-full" />
        {isCreator ? (
          <Link
            to={settingsRoute}
            className="flex absolute top-3 right-3 justify-center items-center w-8 h-8 rounded-lg transition-colors bg-black/40 hover:bg-black/60"
          >
            <Settings className="w-[18px] h-[18px] [&>path]:stroke-white [&>line]:stroke-white [&>polyline]:stroke-white [&>circle]:stroke-white" />
          </Link>
        ) : null}
      </div>

      <div className="flex relative z-10 gap-4 items-start px-4 -mt-7">
        {profileUrl !== "" ? (
          <img src={profileUrl} alt={displayName} className="object-cover object-top w-20 h-20 shrink-0 rounded-[16px]" />
        ) : (
          <div className="w-20 h-20 shrink-0 rounded-[16px] bg-neutral-600" />
        )}

        <div className="flex flex-col flex-1 gap-1 pt-9 min-w-0">
          <div className="flex gap-3 items-center">
            <h1 className="text-xl font-bold text-text-primary">{displayName}</h1>
            {loggedIn ? (
              isFollowing ? (
                <button
                  className="py-1 px-4 text-sm font-semibold rounded-full border transition-colors disabled:opacity-50 border-border text-foreground-muted hover:bg-hover"
                  disabled={processing}
                  onClick={() => onUnfollow()}
                >
                  {/* Rust hardcodes the label (team_header.rs:63). */}
                  Unfollow
                </button>
              ) : (
                <button
                  className="py-1 px-4 text-sm font-semibold rounded-full border transition-colors disabled:opacity-50 border-border text-text-primary hover:bg-hover"
                  disabled={processing}
                  onClick={() => onFollow()}
                >
                  {/* Rust hardcodes the label (team_header.rs:70). */}
                  Follow
                </button>
              )
            ) : null}
          </div>
          {description !== "" ? (
            <p className="text-sm leading-5 text-foreground-muted line-clamp-2" dangerouslySetInnerHTML={{ __html: description }} />
          ) : null}
        </div>

        {rightSlot !== undefined ? <div className="self-start pt-9 shrink-0">{rightSlot}</div> : null}
      </div>
    </div>
  );
}
