import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  useFollowUserPostApiMyFollowerFollow,
  useUnfollowUserDeleteApiMyFollowerFollow,
} from "@ratel/ts-bridges/hooks";
import { SelectedCategoryProvider } from "@/components/social/wall-context";
import { TeamArenaProvider, TeamArenaTab, useTeamArena } from "@/components/social/team-arena-context";
import { useUserContext } from "@/lib/auth";
import { useLegacyScript } from "@/lib/legacy-scripts";
import teamArenaScript from "../../../legacy-scripts/features/social/pages/team_arena/script.js?url&no-inline";
import { ArenaSettingsPanel } from "./arena-settings-panel";
import { ArenaTopbar } from "./arena-topbar";

// app/ratel/src/features/social/pages/team_arena/layout.rs (`TeamArenaLayout`):
// installs `TeamArenaContext` (+ the raw team id and the category filter) and
// renders the arena background, topbar, page outlet and settings panel.
export function TeamArenaLayout() {
  return (
    <TeamArenaProvider>
      <SelectedCategoryProvider>
        <TeamArenaChrome />
      </SelectedCategoryProvider>
    </TeamArenaProvider>
  );
}

function TeamArenaChrome() {
  useLegacyScript(teamArenaScript);
  const ctx = useTeamArena();
  const loggedIn = useUserContext().user !== null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [followProcessing, setFollowProcessing] = useState(false);
  const follow = useFollowUserPostApiMyFollowerFollow();
  const unfollow = useUnfollowUserDeleteApiMyFollowerFollow();

  const onFollowClick = async () => {
    if (followProcessing) return;
    setFollowProcessing(true);
    // `TeamPartition` → `Partition` (`TEAM#<id>`).
    const pk = `TEAM#${ctx.teamId}`;
    try {
      if (ctx.following) {
        await unfollow.mutateAsync(pk);
        ctx.setFollowing(false);
      } else {
        await follow.mutateAsync(pk);
        ctx.setFollowing(true);
      }
    } catch (e) {
      console.debug("follow toggle failed:", e);
    }
    setFollowProcessing(false);
  };

  return (
    <div className="team-arena" data-testid="team-arena-layout">
      <div className="team-arena__bg-grid">
        <div className="team-arena__bg-grid-plane" />
      </div>
      <div className="team-arena__bg-orbs">
        <div className="team-arena__bg-orb team-arena__bg-orb--1" />
        <div className="team-arena__bg-orb team-arena__bg-orb--2" />
        <div className="team-arena__bg-orb team-arena__bg-orb--3" />
      </div>
      <div className="team-arena__bg-stars" />
      <div className="team-arena__bg-scanline" />

      <ArenaTopbar
        username={ctx.username}
        displayName={ctx.displayName}
        profileUrl={ctx.profileUrl}
        // Always Home, like the running Dioxus app: `TeamArenaLayout` rebuilds
        // its context (`Signal::new(TeamArenaTab::Home)`) on every render, so a
        // page's `active_tab.set(..)` never reaches the topbar and no HUD button
        // ever gets `arena-topbar__hud--active` (measured on hard loads and SPA
        // navigation). Tracked in the migration doc §12; fix both sides together.
        active={TeamArenaTab.Home}
        canEdit={ctx.canEdit}
        isMember={ctx.isMember}
        isParentEligible={ctx.isParentEligible}
        pendingApplicantUsername={ctx.viewerPendingApplicantUsername}
        viewerHasEligibleApplicantTeam={ctx.viewerHasEligibleApplicantTeam}
        showFollow={loggedIn && !ctx.isMember}
        isFollowing={ctx.following}
        onFollow={() => void onFollowClick()}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="team-arena__content">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>

      <ArenaSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        username={ctx.username}
        canEdit={ctx.canEdit}
      />
    </div>
  );
}
