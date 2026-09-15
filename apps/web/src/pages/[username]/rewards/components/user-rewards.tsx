import { Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { LaunchpadTokenCard, RewardHero } from "@/components/launchpad-partner";
import { useUserRewardsI18n } from "./user-rewards.i18n";
import { useUserRewards } from "../hooks/use-user-rewards";
import { RewardHistorySection } from "./reward-history-section";

// app/ratel/src/features/social/pages/reward/user/views/mod.rs (`Home`) — the
// user rewards page: back topbar, share-of-pool hero with the conversion
// entry, token holdings, reward history.
//
// The sibling `views/script.js` is never loaded by the Rust page (no
// `document::Script`), so it is not loaded here either.

export function UserRewards({ username }: { username: string }) {
  const tr = useUserRewardsI18n();
  const navigate = useNavigate();
  const { points } = useUserRewards(username);

  return (
    <div className="rewards-arena">
      <div className="arena-topbar">
        <div className="arena-topbar__left">
          {/* Rust `nav.go_back()` — plain history back, no fallback. */}
          <button className="back-btn" aria-label={tr.back} onClick={() => navigate(-1)}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="topbar-title">
            <span className="topbar-title__main">{tr.pageTitle}</span>
          </div>
        </div>
      </div>
      <div className="page">
        <Suspense fallback={null}>
          <RewardHero points={points} showConvert />
        </Suspense>
        <Suspense fallback={null}>
          <LaunchpadTokenCard />
        </Suspense>
        <RewardHistorySection username={username} />
      </div>
    </div>
  );
}
