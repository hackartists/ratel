import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSignOut } from "@/components/auth";
import { TeamCreationPopup } from "@/components/team-creation/team-creation-popup";
import { useProfileDropdownI18n } from "@/i18n/generated/components/profile_dropdown/profile-dropdown.i18n";
import { useUserContext } from "@/lib/auth";
import { usePopup } from "@/lib/popup";
import { useTeamContext } from "@/lib/teams";
import { AccountDeletionConfirm } from "./account-deletion-confirm";

// app/ratel/src/components/profile_dropdown/mod.rs (`ProfileDropdown`) — avatar
// trigger with a dropdown of the user and their teams, Create Team, Log Out and
// Delete Account. Signed out it renders an empty `<div>`.
//
// No route renders it in the Dioxus app today (the home arena replaced the old
// navbar); it is ported with its popups so nothing it can open is missing.

export function ProfileDropdown() {
  const tr = useProfileDropdownI18n();
  const user = useUserContext().user;
  const teamCtx = useTeamContext();
  const [open, setOpen] = useState(false);
  const popup = usePopup();
  const navigate = useNavigate();
  const signOut = useSignOut();

  if (user === null) return <div />;

  return (
    <div className="relative">
      <button className="flex flex-col justify-center items-center p-2.5 cursor-pointer group" onClick={() => setOpen(!open)}>
        {user.profile_url !== "" ? (
          <img src={user.profile_url} alt="User Profile" className="object-cover w-6 h-6 rounded-full" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-neutral-500" />
        )}
        <span className="font-medium transition-colors text-menu-text text-[15px] max-w-20 truncate group-hover:text-menu-text/80">
          {user.display_name}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-998" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full p-2.5 rounded-lg border w-[250px] border-divider bg-bg z-999">
            <div className="px-2 text-xs text-c-secondary py-1">{tr.teams}</div>

            <div className="overflow-y-auto pr-2 -mr-2 max-h-[300px]">
              <Link
                className="flex gap-2 items-center py-1.5 px-2 w-full rounded-md cursor-pointer hover:bg-hover"
                to="/"
                onClick={() => setOpen(false)}
              >
                {user.profile_url !== "" ? (
                  <img
                    src={user.profile_url}
                    alt={user.display_name}
                    className="object-cover object-top w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-neutral-600" />
                )}
                <span className="text-sm text-c-secondary truncate">{user.display_name}</span>
              </Link>

              {teamCtx.teams.map((team) => (
                <Link
                  key={team.pk}
                  className="flex gap-2 items-center py-1.5 px-2 w-full rounded-md cursor-pointer hover:bg-hover"
                  to={`/${team.username}/home`}
                  onClick={() => setOpen(false)}
                >
                  {team.profile_url !== "" ? (
                    <img src={team.profile_url} alt={team.nickname} className="object-cover object-top w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-neutral-600" />
                  )}
                  <span className="text-sm text-c-secondary truncate">{team.nickname}</span>
                </Link>
              ))}
            </div>

            <div className="my-2 h-px bg-divider" />

            <button
              className="py-1.5 px-2 w-full text-sm text-left rounded-md cursor-pointer text-c-secondary hover:bg-hover"
              onClick={() => {
                setOpen(false);
                popup.open(<TeamCreationPopup />, { title: tr.createTeam });
              }}
            >
              {tr.createTeam}
            </button>

            <button
              className="py-1.5 px-2 w-full text-sm text-left rounded-md cursor-pointer text-c-secondary hover:bg-hover"
              onClick={() => {
                setOpen(false);
                void signOut().then(() => navigate("/"));
              }}
            >
              {tr.logout}
            </button>

            <button
              className="py-1.5 px-2 w-full text-sm text-left text-red-500 rounded-md cursor-pointer hover:bg-hover"
              onClick={() => {
                setOpen(false);
                popup.open(<AccountDeletionConfirm />, { title: tr.deleteAccount });
              }}
            >
              {tr.deleteAccount}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
