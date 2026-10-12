import { useNavigate } from "react-router-dom";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listActions } from "@ratel/ts-bridges";
import type { SpaceActionSummary, SpaceActionType } from "@ratel/ts-bridges";
import { useActionOverlay } from "@/components/space/action-overlay";
import { spaceQueryKeys, useSpaceContext } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useSpaceViewerI18n } from "./space-viewer.i18n";
import { dataBool } from "@/lib/dom";

// app/ratel/src/features/spaces/pages/index/prerequisite_card/component.rs (`PrerequisiteCard`).

/** Rust `SpaceActionSummary::get_url` (pages/actions/types/space_action.rs:68). */
export function actionUrl(action: SpaceActionSummary, spaceId: string): string {
  switch (action.action_type) {
    case "Poll":
      return `/spaces/${spaceId}/actions/polls/${action.action_id}`;
    case "TopicDiscussion":
      return `/spaces/${spaceId}`;
    case "Follow":
      return `/spaces/${spaceId}/actions/follows/${action.action_id}`;
    case "Quiz":
      return `/spaces/${spaceId}/actions/quizzes/${action.action_id}`;
    case "Meet":
      return `/spaces/${spaceId}/actions/meets/${action.action_id}`;
    case "Announcement":
      return `/spaces/${spaceId}/actions/announcements/${action.action_id}`;
  }
}

export function PrerequisiteCard() {
  const tr = useSpaceViewerI18n();
  const t = useEnumI18n();
  const navigate = useNavigate();
  const { spaceId } = useSpaceContext();
  const { setOverlay } = useActionOverlay();
  // Rust's own `use_loader(list_actions)` — same query as the context's actions.
  const { data: actions } = useSuspenseQuery({
    queryKey: spaceQueryKeys.actions(spaceId),
    queryFn: () => listActions(spaceId),
  });

  const prereqs = actions.filter((a) => a.prerequisite);
  const doneCount = prereqs.filter((a) => a.user_participated).length;
  const totalCount = prereqs.length;
  const progressPct = totalCount > 0 ? Math.trunc((doneCount / totalCount) * 100) : 0;

  const open = (action: SpaceActionSummary, isDone: boolean) => {
    switch (action.action_type) {
      // Poll is always clickable — the poll page handles response editability.
      case "Poll":
        setOverlay({ kind: "Poll", spaceId, pollId: action.action_id });
        return;
      case "Quiz":
        if (!isDone) setOverlay({ kind: "Quiz", spaceId, quizId: action.action_id });
        return;
      case "TopicDiscussion":
        if (!isDone) navigate(`/spaces/${spaceId}/discussions/${action.action_id}`);
        return;
      case "Follow":
        if (!isDone) navigate(actionUrl(action, spaceId));
        return;
      default:
        return;
    }
  };

  return (
    <div className="prereq-card" data-testid="card-prerequisite">
      <span className="prereq-card__heading">{tr.prereqHeading}</span>
      <p className="prereq-card__desc">{tr.prereqDesc}</p>

      <div className="prereq-card__progress">
        <div className="prereq-card__progress-bar-wrap">
          <div className="prereq-card__progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="prereq-card__progress-text">
          {doneCount} / {totalCount}
        </span>
      </div>

      <div className="prereq-card__list">
        {prereqs.map((action) => {
          const isDone = action.user_participated;
          return (
            <div
              key={action.action_id}
              className="prereq-item"
              data-done={dataBool(isDone)}
              data-testid={`prereq-item-${action.action_id}`}
              onClick={() => open(action, isDone)}
            >
              <div className="prereq-item__icon">
                <ActionTypeIcon actionType={action.action_type} />
              </div>
              <div className="prereq-item__info">
                <span className="prereq-item__title">{action.title}</span>
                <span className="prereq-item__type">{t("SpaceActionType", action.action_type)}</span>
              </div>
              {isDone ? (
                <div className="prereq-item__status prereq-item__status--done">
                  <svg
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
              ) : (
                <div className="prereq-item__status prereq-item__status--pending">
                  {tr.prereqPending}
                  <svg
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionTypeIcon({ actionType }: { actionType: SpaceActionType }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
  };
  switch (actionType) {
    case "Poll":
      return (
        <svg {...common}>
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      );
    case "Quiz":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
      );
    case "TopicDiscussion":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "Follow":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
      );
    case "Meet":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="14" height="14" rx="2" ry="2" />
          <path d="M21 7l-4 4 4 4z" />
        </svg>
      );
    case "Announcement":
      return (
        <svg {...common}>
          <path d="M3 11l18-5v12L3 14v-3z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      );
  }
}
