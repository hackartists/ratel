// app/ratel/src/features/spaces/pages/actions/actions/meet/components/meet_card/component.rs —
// `MeetActionCard`: quest card for a meet; the card navigates to the meet page.
// Hardcoded Korean literals ("새 회의", "설정 중", "재진입") and "MEET" are kept
// exactly as the Rust source writes them.
import { useNavigate } from "react-router-dom";
import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { EntityPrefix, subPartitionId } from "@/components/space/create-space-action";
import { useSpaceContext } from "@/components/space/space-context";
import { Button } from "@/components/ui/button";
import { useMeetActionI18n } from "@/pages/spaces/[spaceId]/i18n";
import { dataBool } from "@/lib/dom";

type MeetPhase = "Draft" | "Live" | "Ended";

function derivePhase(action: SpaceActionSummary): MeetPhase {
  const status = action.status ?? "Designing";
  switch (status) {
    case "Designing":
      return "Draft";
    case "Ongoing":
      return "Live";
    case "Finish":
      return "Ended";
  }
}

function phaseStr(phase: MeetPhase): string {
  switch (phase) {
    case "Draft":
      return "draft";
    case "Live":
      return "live";
    case "Ended":
      return "ended";
  }
}

export function MeetActionCard({ action, isAdmin: _isAdmin = false }: { action: SpaceActionSummary; isAdmin?: boolean }) {
  const tr = useMeetActionI18n();
  const navigate = useNavigate();
  const spaceId = useSpaceContext().spaceId;
  const phase = derivePhase(action);
  const phaseString = phaseStr(phase);
  const meetId = subPartitionId(action.action_id, EntityPrefix.SpaceMeet);

  const titleDisplay = action.title === "" ? "새 회의" : action.title;

  const go = () => navigate(`/spaces/${spaceId}/actions/meets/${meetId}`);

  return (
    <div
      className="quest-card quest-card--meet"
      data-testid="action-card-meet"
      data-kind="meet"
      data-type="meet"
      data-phase={phaseString}
      data-prerequisite={dataBool(action.prerequisite)}
      onClick={go}
    >
      {/* Hero icon (video camera for Meet) */}
      <svg
        className="quest-card__hero"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>

      <div className="quest-card__top">
        <span className="quest-card__type quest-card__type--meet">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          MEET
        </span>
        <div className="quest-card__top-actions">
          {phase === "Draft" && <span className="quest-card__badge quest-card__badge--draft">설정 중</span>}
          {phase === "Live" && <span className="quest-card__badge quest-card__badge--live">{tr.liveLabel}</span>}
          {phase === "Ended" && <span className="quest-card__badge quest-card__badge--ended">{tr.endedLabel}</span>}
          {action.credits > 0 && (
            <span className="quest-card__badge quest-card__badge--credits">{`+${action.credits} CR`}</span>
          )}
        </div>
      </div>

      <div className="quest-card__body">
        <div className="quest-card__title">{titleDisplay}</div>
        {action.description !== "" && (
          <div className="quest-card__desc" dangerouslySetInnerHTML={{ __html: action.description }} />
        )}
      </div>

      <div className="quest-card__footer">
        <div className="quest-card__reward">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12" />
            <path d="M16 10H8" />
          </svg>
          {`${action.credits} CR`}
        </div>
        {phase === "Draft" && <span className="quest-card__cta quest-card__cta--start">재진입</span>}
        {phase === "Live" && (
          <Button disabled data-testid="meet-card-join">
            <span>{`${tr.liveCta} · `}</span>
            <span className="quest-card__badge quest-card__badge--coming-soon">{tr.comingSoonBadge}</span>
          </Button>
        )}
        {phase === "Ended" && (
          <Button disabled data-testid="meet-card-archive">
            <span>{`${tr.endedCta} · `}</span>
            <span className="quest-card__badge quest-card__badge--coming-soon">{tr.comingSoonBadge}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
