import { Suspense } from "react";
import type { TeamPartition } from "@ratel/ts-bridges";
import { LaunchpadTokenCard, RewardHero } from "@/components/launchpad-partner";
import { TeamArenaTab, useTeamArenaTab } from "@/components/social/team-arena-context";
import { useTeamRewardsI18n } from "@/i18n/generated/features/social/pages/reward/team/views/team-rewards.i18n";
import { useTeamRewardPermission, useTeamRewardPoints } from "../hooks/use-team-rewards";
import { RewardHistorySection } from "./reward-history-section";

// app/ratel/src/features/social/pages/reward/team/views/mod.rs (`Home`) — the
// team rewards page: team points hero, the viewer's token holdings, the team's
// reward history. No topbar (the team arena layout owns it).
//
// The sibling `views/script.js` is never loaded by the Rust page (no
// `document::Script`), so it is not loaded here either.

export function TeamRewards({ username }: { username: string }) {
  // Rust `use_effect(move || arena.active_tab.set(TeamArenaTab::Rewards))`,
  // declared before the loaders. The Suspense below renders nothing — the
  // same as the SuspenseBoundary TeamArenaLayout puts around the outlet —
  // and lets the tab effect commit while the loaders are pending.
  useTeamArenaTab(TeamArenaTab.Rewards);
  return (
    <Suspense fallback={null}>
      <TeamRewardsBody username={username} />
    </Suspense>
  );
}

function TeamRewardsBody({ username }: { username: string }) {
  const tr = useTeamRewardsI18n();
  const perm = useTeamRewardPermission(username);

  if (!perm) {
    return (
      <div className="rewards-arena">
        <div className="page">
          <div className="empty">
            <div className="empty-desc">{tr.activityEmpty}</div>
          </div>
        </div>
      </div>
    );
  }
  return <TeamRewardsLoaded username={username} teamPk={perm.team_pk} />;
}

function TeamRewardsLoaded({ username, teamPk }: { username: string; teamPk: TeamPartition }) {
  const teamPoints = useTeamRewardPoints(teamPk);

  return (
    <div className="rewards-arena">
      <div className="page">
        <Suspense fallback={null}>
          <RewardHero points={teamPoints} />
        </Suspense>
        <Suspense fallback={null}>
          <LaunchpadTokenCard />
        </Suspense>
        <RewardHistorySection username={username} />
      </div>
    </div>
  );
}
