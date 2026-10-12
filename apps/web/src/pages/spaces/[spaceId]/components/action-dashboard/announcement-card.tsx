import { useNavigate } from "react-router-dom";
import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { useSpaceContext } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useSpaceViewerI18n } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";
import { dataBool } from "@/lib/dom";

/** Quest card for the space announcement; always active, opens the announcement page. */
export function AnnouncementActionCard({ action }: { action: SpaceActionSummary }) {
  const tr = useSpaceViewerI18n();
  const te = useEnumI18n();
  const navigate = useNavigate();
  const spaceId = useSpaceContext().spaceId;
  const isDraft = (action.status ?? "Designing") === "Designing";

  return (
    <div
      className="quest-card quest-card--announcement"
      data-testid="action-card-announcement"
      data-kind="announcement"
      data-type="announcement"
      data-prerequisite={dataBool(false)}
      onClick={() => navigate(`/spaces/${spaceId}/actions/announcements/${action.action_id}`)}
    >
      <svg
        className="quest-card__hero"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M3 11l18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>

      <div className="quest-card__top">
        <span className="quest-card__type">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M3 11l18-5v12L3 14v-3z" />
            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
          </svg>
          {tr.announcementName}
        </span>
        {isDraft && (
          <div className="quest-card__top-actions">
            <span className="quest-card__badge quest-card__badge--draft">{te("SpaceActionStatus", "Designing")}</span>
          </div>
        )}
      </div>

      <div className="quest-card__body">
        <div className="quest-card__title">{action.title === "" ? tr.announcementName : action.title}</div>
        {action.description !== "" && (
          <div className="quest-card__desc" dangerouslySetInnerHTML={{ __html: action.description }} />
        )}
      </div>

      <div className="quest-card__footer">
        <span className="quest-card__cta quest-card__cta--start" data-testid="announcement-card-open">
          {tr.announcementView}
        </span>
      </div>
    </div>
  );
}
