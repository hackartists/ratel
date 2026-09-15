import { useState } from "react";
import { Link, Outlet, useMatch } from "react-router-dom";
import { useFindTeam, useListCategoriesHandler } from "@ratel/ts-bridges/hooks";
import { LoginModal, SignupModal } from "@/components/auth";
import { useSignOut } from "@/components/auth/use-sign-out";
import { Trophy } from "@/components/icons/game";
import { ChevronLeft, Ellipsis, FileText, LogOut, Settings } from "@/components/icons/lucide";
import { roleFromPermissions } from "@/components/social/team-arena/team-role";
import { useTeamContext } from "@/components/social/use-team-context";
import { SelectedCategoryProvider, useSelectedCategory, useWallContext } from "@/components/social/wall-context";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { useTeamMenuI18n } from "./i18n";
import { useUserContext } from "@/lib/auth";
import { usePopup } from "@/lib/popup";

// app/ratel/src/features/social/layout.rs (`UserLayout`, `TeamSidemenu`): the
// user wall layout — tablet+ sidebar (profile, auth buttons, categories, admin
// drafts link, account menu) and the scrolling page area.

export function UserLayout({ username }: { username: string }) {
  const loggedIn = useUserContext().user !== null;
  return (
    <SelectedCategoryProvider>
      <div
        className="grid overflow-hidden grid-cols-1 w-full h-full bg-team-bg text-text-primary"
        data-testid="social-layout"
      >
        <div className="hidden overflow-hidden h-screen tablet:flex">
          <TeamSidemenu key={username} username={username} loggedIn={loggedIn} />
        </div>
        <div className="flex overflow-hidden flex-col min-w-0 min-h-0">
          <div className="flex overflow-auto flex-col flex-1 p-5 w-full social-scroll bg-background rounded-tl-[10px] max-tablet:p-3 max-mobile:p-2">
            <Outlet />
          </div>
        </div>
      </div>
    </SelectedCategoryProvider>
  );
}

const ACTIVE_ITEM = "bg-hover text-text-primary";
const INACTIVE_ITEM = "text-foreground-muted hover:bg-hover hover:text-text-primary";

function TeamSidemenu({ username, loggedIn }: { username: string; loggedIn: boolean }) {
  const tr = useTeamMenuI18n();
  const user = useUserContext().user;
  const teamCtx = useTeamContext();
  const wallCtx = useWallContext();
  const popup = usePopup();
  const signOut = useSignOut();
  const { category, setCategory } = useSelectedCategory();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isRewardPage = useMatch("/:username/rewards") !== null;
  const isDraftActive = useMatch("/:username/drafts") !== null;

  // `find_team_handler` only on team walls (layout.rs:94-108); on user walls
  // the loader resolves to an error and the fallback path renders.
  const team = useFindTeam(username, { enabled: wallCtx.isTeam, retry: false });
  // `use_resource(list_categories_handler(None))` — empty until it answers.
  const categories = useListCategoriesHandler(null, { retry: false });
  const cats = categories.data?.items ?? [];

  const fallbackTeam = teamCtx.teams.find((t) => t.username === username) ?? null;

  let profileUrl = "";
  let displayName = username;
  let permissions: number[] = [];
  const found = wallCtx.isTeam ? team.data : undefined;
  if (found && found.pk !== "" && found.username !== "") {
    const fromCtx = fallbackTeam?.permissions ?? [];
    permissions = fromCtx.length > 0 ? fromCtx : (found.permissions ?? []);
    profileUrl = found.profile_url ?? "";
    displayName = found.nickname === "" ? found.username : found.nickname;
  } else if (fallbackTeam) {
    profileUrl = fallbackTeam.profile_url;
    displayName = fallbackTeam.nickname === "" ? fallbackTeam.username : fallbackTeam.nickname;
    permissions = fallbackTeam.permissions;
  }

  const role = roleFromPermissions(permissions);
  const isAdmin = role === "owner";
  const canTeamEdit = role === "owner" || role === "admin";
  const isTeamMember = permissions.length > 0;
  // Rust hardcodes the role label and the "Category" / "All" labels (layout.rs:151-155,219,233).
  const userRole = isAdmin || canTeamEdit ? "Creator" : "Viewer";

  const userDisplay = user?.display_name ?? "";
  const userProfile = user?.profile_url ?? "";

  return (
    <div className="flex overflow-hidden flex-col w-full h-full">
      {isRewardPage && (
        <div className="px-4 pt-4 pb-2 shrink-0">
          <Link
            // Rust `Route::SocialIndex { username }.to_string()` renders the
            // nested index route with a trailing slash (`/{username}/`) —
            // match it exactly so the `href` matches byte-for-byte.
            to={`/${username}/`}
            className="flex gap-1.5 items-center text-sm transition-colors text-foreground-muted hover:text-text-primary"
          >
            <ChevronLeft className="w-4 h-4 [&>polyline]:stroke-current shrink-0" />
            {tr.backToPage}
          </Link>
        </div>
      )}
      <div className="flex justify-between items-center py-4 px-4 shrink-0">
        <div className="flex gap-3 items-center min-w-0">
          {profileUrl !== "" ? (
            <img
              src={profileUrl}
              alt={displayName}
              className="object-cover object-top w-10 h-10 rounded-[10px] shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-[10px] bg-neutral-600 shrink-0" />
          )}
          <span className="text-base font-bold text-text-primary truncate">{displayName}</span>
        </div>
      </div>

      {!loggedIn && (
        <div className="flex flex-col gap-2 px-4 pb-4 shrink-0">
          <Button
            buttonStyle={ButtonStyle.Primary}
            shape={ButtonShape.Rounded}
            className="w-full"
            onClick={() => popup.open(<SignupModal />)}
          >
            {tr.signUp}
          </Button>
          <Button
            buttonStyle={ButtonStyle.Outline}
            shape={ButtonShape.Rounded}
            className="w-full"
            onClick={() => popup.open(<LoginModal />)}
          >
            {tr.logIn}
          </Button>
        </div>
      )}

      <div className="flex overflow-y-auto flex-col flex-1 px-3 pb-4 min-h-0">
        <span className="px-2 pb-2 text-xs font-semibold tracking-wider uppercase text-foreground-muted">Category</span>
        <button
          className={`flex gap-2.5 items-center py-2 px-2 w-full text-sm font-medium text-left rounded-lg transition-colors ${category === null ? ACTIVE_ITEM : INACTIVE_ITEM}`}
          onClick={() => setCategory(null)}
        >
          <span className="text-base font-bold text-foreground-muted">#</span>
          <span>All</span>
        </button>
        {cats.map((cat) => (
          <button
            key={cat.name}
            className={`flex gap-2.5 items-center py-2 px-2 w-full text-sm font-medium text-left rounded-lg transition-colors ${category === cat.name ? ACTIVE_ITEM : INACTIVE_ITEM}`}
            onClick={() => setCategory(cat.name)}
          >
            <span className="text-base font-bold text-foreground-muted">#</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {canTeamEdit && (
        <div className="flex flex-col px-3 pb-4 shrink-0">
          <Link
            to={`/${username}/drafts`}
            className={`flex gap-2.5 items-center py-2 px-2 w-full text-sm font-medium text-left rounded-lg transition-colors ${isDraftActive ? ACTIVE_ITEM : INACTIVE_ITEM}`}
          >
            <FileText className="w-4 h-4 [&>path]:stroke-current [&>polyline]:stroke-current [&>line]:stroke-current shrink-0" />
            <span>{tr.drafts}</span>
          </Link>
        </div>
      )}

      {loggedIn && (
        <div className="relative py-3 px-3 border-t shrink-0 border-separator">
          {showUserMenu && <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />}
          <div className="flex gap-3 items-center py-2 px-2 rounded-lg transition-colors hover:bg-hover">
            {userProfile !== "" ? (
              <img src={userProfile} alt={userDisplay} className="object-cover w-9 h-9 rounded-full shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-neutral-600 shrink-0" />
            )}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold text-text-primary truncate">{userDisplay}</span>
              <span className="text-xs text-foreground-muted">{userRole}</span>
            </div>
            <button
              className="flex relative z-20 justify-center items-center w-7 h-7 rounded-md transition-colors shrink-0 hover:bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
            >
              <Ellipsis className="w-4 h-4 [&>circle]:fill-text-primary [&>circle]:stroke-none" />
            </button>
          </div>
          {showUserMenu && (
            <div
              className="overflow-hidden absolute right-3 left-3 bottom-full z-30 py-1 mb-1 rounded-lg border shadow-lg bg-popover border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {canTeamEdit && (
                <Link
                  to={`/${username}/rewards`}
                  className="flex gap-2 items-center py-2 px-3 w-full text-sm text-left transition-colors text-text-primary hover:bg-hover"
                  onClick={() => setShowUserMenu(false)}
                  data-pw="team-reward-menu-link"
                >
                  <Trophy className="w-[15px] h-[15px] [&>path]:stroke-text-primary [&>path]:fill-transparent shrink-0" />
                  {tr.rewards}
                </Link>
              )}
              {isTeamMember && (
                <Link
                  to={canTeamEdit ? `/${username}/settings` : `/${username}/settings/members`}
                  className="flex gap-2 items-center py-2 px-3 w-full text-sm text-left transition-colors text-text-primary hover:bg-hover"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-[15px] h-[15px] [&>path]:stroke-text-primary [&>line]:stroke-text-primary [&>polyline]:stroke-text-primary [&>circle]:stroke-text-primary shrink-0" />
                  {tr.settings}
                </Link>
              )}
              <button
                className="flex gap-2 items-center py-2 px-3 w-full text-sm text-left transition-colors text-destructive hover:bg-hover"
                onClick={() => {
                  setShowUserMenu(false);
                  void signOut();
                }}
              >
                <LogOut className="w-[15px] h-[15px] [&>path]:stroke-destructive shrink-0" />
                {tr.logOut}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
