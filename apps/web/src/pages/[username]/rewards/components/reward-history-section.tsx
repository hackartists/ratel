import type { RewardHistoryItem } from "@ratel/ts-bridges";
import { useRewardHistorySectionI18n } from "@/i18n/generated/features/social/pages/reward/user/components/reward-history-section.i18n";
import { formatWithCommas, formatYyyyMmDd } from "../format";
import { useRewardHistory } from "../hooks/use-reward-history";

// app/ratel/src/features/social/pages/reward/user/components/reward_history_section.rs
// (`RewardHistorySection`) — per-event reward rows for a user or team, with a
// "Load more" button. Shared by the user and team rewards pages.

// Rust hardcodes the missing-value dash outside translate! (reward_history_section.rs:157-158).
const MISSING = "—";

export function RewardHistorySection({ username }: { username: string }) {
  const tr = useRewardHistorySectionI18n();
  const { items, hasMore, fetching, loaded, loadMore } = useRewardHistory(username);
  const isEmpty = loaded && items.length === 0;

  return (
    <div>
      <div className="section-head">
        <span className="section-head__title">{tr.title}</span>
      </div>
      <div className="reward-history">
        {isEmpty ? (
          <div className="reward-history__empty">
            <div className="empty__desc">{tr.empty}</div>
          </div>
        ) : (
          <>
            <div className="reward-history__head">
              <span className="reward-history__col reward-history__col--space">{tr.colSpace}</span>
              <span className="reward-history__col reward-history__col--action">{tr.colAction}</span>
              <span className="reward-history__col reward-history__col--point">{tr.colPoint}</span>
              <span className="reward-history__col reward-history__col--date">{tr.colDate}</span>
            </div>
            <div className="reward-history__list">
              {items.map((item) => (
                <RewardHistoryRow
                  key={`${item.transaction_id ?? ""}-${item.created_at}`}
                  item={item}
                  ptsUnit={tr.ptsUnit}
                  labelSpace={tr.colSpace}
                  labelAction={tr.colAction}
                  labelPoint={tr.colPoint}
                  labelDate={tr.colDate}
                />
              ))}
            </div>
          </>
        )}
        {hasMore && (
          <button className="reward-history__loadmore" disabled={fetching} onClick={loadMore}>
            {fetching ? tr.loading : tr.loadMore}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

interface RewardHistoryRowProps {
  item: RewardHistoryItem;
  ptsUnit: string;
  labelSpace: string;
  labelAction: string;
  labelPoint: string;
  labelDate: string;
}

function RewardHistoryRow({ item, ptsUnit, labelSpace, labelAction, labelPoint, labelDate }: RewardHistoryRowProps) {
  const spaceTitle = item.space_title ?? MISSING;
  const actionName = item.action_name ?? MISSING;
  const date = formatYyyyMmDd(item.created_at);
  const pointFmt = formatWithCommas(item.point);
  const sign = item.point >= 0 ? "+" : "";

  return (
    <div className="reward-history__row">
      <div className="reward-history__cell reward-history__cell--space">
        <span className="reward-history__cell-label">{labelSpace}</span>
        <span className="reward-history__cell-value">{spaceTitle}</span>
      </div>
      <div className="reward-history__cell reward-history__cell--action">
        <span className="reward-history__cell-label">{labelAction}</span>
        <span className="reward-history__cell-value">{actionName}</span>
      </div>
      <div className="reward-history__cell reward-history__cell--point">
        <span className="reward-history__cell-label">{labelPoint}</span>
        <span
          className={
            item.point >= 0
              ? "reward-history__point reward-history__point--in"
              : "reward-history__point reward-history__point--out"
          }
        >
          {`${sign}${pointFmt} `}
          <small>{ptsUnit}</small>
        </span>
      </div>
      <div className="reward-history__cell reward-history__cell--date">
        <span className="reward-history__cell-label">{labelDate}</span>
        <span className="reward-history__cell-value reward-history__cell-value--date">{date}</span>
      </div>
    </div>
  );
}
