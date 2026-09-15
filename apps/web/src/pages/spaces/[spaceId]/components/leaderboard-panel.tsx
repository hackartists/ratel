import { Suspense } from "react";
import type { RankingEntryResponse } from "@ratel/ts-bridges";
import { useSpaceContext } from "@/components/space/space-context";
import { useSpaceViewerI18n } from "./space-viewer.i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";

// app/ratel/src/features/spaces/pages/index/leaderboard_panel/component.rs (`LeaderboardPanel`).

export function LeaderboardPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useSpaceViewerI18n();
  return (
    <div className="leaderboard-panel" data-testid="leaderboard-panel" data-open={dataBool(open)}>
      <div className="leaderboard-panel__header">
        <span className="leaderboard-panel__title">{tr.leaderboard}</span>
        <button aria-label="Close leaderboard" className="leaderboard-panel__close" onClick={() => onClose()}>
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        </button>
      </div>
      {open && (
        <Suspense fallback={null}>
          <LeaderboardContent />
        </Suspense>
      )}
    </div>
  );
}

/** Rust `use_space_user()?` (features/spaces/hooks/use_space_user.rs): fails signed out. */
function useSpaceUser(): { pk: string; username: string } {
  const { space } = useSpaceContext();
  const user = useUserContext().user;
  if (user === null) throw new Error("UnauthorizedAccess");
  if (space.participated) return { pk: user.pk, username: space.participant_username ?? "" };
  return { pk: user.pk, username: user.username };
}

function LeaderboardContent() {
  const tr = useSpaceViewerI18n();
  const { ranking, myScore } = useSpaceContext();
  const user = useSpaceUser();

  const entries = ranking.items;
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <>
      {myScore.rank > 0 && (
        <>
          <div className="leaderboard-my-rank">
            <div className="leaderboard-my-rank__position">#{myScore.rank}</div>
            <div className="leaderboard-my-rank__info">
              <div className="leaderboard-my-rank__label">{tr.yourRank}</div>
              <div className="leaderboard-my-rank__name">{user.username}</div>
            </div>
            <div>
              <div className="leaderboard-my-rank__score">{myScore.total_score}</div>
              <div className="leaderboard-my-rank__score-label">{tr.totalXp}</div>
            </div>
          </div>
          <div className="leaderboard-breakdown">
            <div className="leaderboard-breakdown__item leaderboard-breakdown__item--poll">
              <span className="leaderboard-breakdown__value">{myScore.poll_score}</span>
              <span className="leaderboard-breakdown__label">{tr.pollLabel}</span>
            </div>
            <div className="leaderboard-breakdown__item leaderboard-breakdown__item--quiz">
              <span className="leaderboard-breakdown__value">{myScore.quiz_score}</span>
              <span className="leaderboard-breakdown__label">{tr.quizLabel}</span>
            </div>
            <div className="leaderboard-breakdown__item leaderboard-breakdown__item--discussion">
              <span className="leaderboard-breakdown__value">{myScore.discussion_score}</span>
              <span className="leaderboard-breakdown__label">{tr.discussionLabel}</span>
            </div>
            <div className="leaderboard-breakdown__item leaderboard-breakdown__item--follow">
              <span className="leaderboard-breakdown__value">{myScore.follow_score}</span>
              <span className="leaderboard-breakdown__label">{tr.followLabel}</span>
            </div>
          </div>
        </>
      )}

      <div className="leaderboard-panel__body">
        {entries.length === 0 ? (
          <div className="leaderboard-empty">
            <span className="leaderboard-empty__text">{tr.noRankingYet}</span>
          </div>
        ) : (
          <>
            <span className="leaderboard-section-label">{tr.topParticipants}</span>
            {top3.length >= 3 && (
              <>
                <div className="leaderboard-podium">
                  <PodiumEntry entry={top3[1]} place={2} />
                  <PodiumEntry entry={top3[0]} place={1} />
                  <PodiumEntry entry={top3[2]} place={3} />
                </div>
                <div className="leaderboard-divider" />
              </>
            )}
            <div className="leaderboard-list">
              {(top3.length < 3 ? entries : rest).map((entry) => (
                <LeaderboardEntry key={entry.rank} entry={entry} isMe={user.pk === entry.user_pk} youLabel={tr.you} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function firstChar(name: string): string {
  return Array.from(name)[0] ?? "?";
}

function PodiumEntry({ entry, place }: { entry: RankingEntryResponse; place: number }) {
  const placeClass =
    place === 1 ? "leaderboard-podium__entry--1st" : place === 2 ? "leaderboard-podium__entry--2nd" : "leaderboard-podium__entry--3rd";
  return (
    <div className={`leaderboard-podium__entry ${placeClass}`}>
      <div className="leaderboard-podium__avatar-wrap">
        {entry.avatar === "" ? (
          <div className="leaderboard-podium__avatar-placeholder">{firstChar(entry.name)}</div>
        ) : (
          <img className="leaderboard-podium__avatar" src={entry.avatar} alt={entry.name} />
        )}
        <div className="leaderboard-podium__medal">{place}</div>
      </div>
      <span className="leaderboard-podium__name">{entry.name}</span>
      <span className="leaderboard-podium__score">{entry.total_score} XP</span>
    </div>
  );
}

function LeaderboardEntry({ entry, isMe, youLabel }: { entry: RankingEntryResponse; isMe: boolean; youLabel: string }) {
  return (
    <div className={isMe ? "leaderboard-entry leaderboard-entry--me" : "leaderboard-entry"}>
      <span className="leaderboard-entry__rank">{entry.rank}</span>
      {entry.avatar === "" ? (
        <div className="leaderboard-entry__avatar-placeholder">{firstChar(entry.name)}</div>
      ) : (
        <img className="leaderboard-entry__avatar" src={entry.avatar} alt={entry.name} />
      )}
      <span className="leaderboard-entry__name">{entry.name}</span>
      {isMe && <span className="leaderboard-entry__me-badge">{youLabel}</span>}
      <span className="leaderboard-entry__score">{entry.total_score} XP</span>
    </div>
  );
}
