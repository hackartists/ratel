import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { SpaceStatus, useSpaceContext } from "@/components/space/space-context";
import { PrerequisiteCard } from "./prerequisite-card";
import { WaitingCard } from "./waiting-card";

// app/ratel/src/features/spaces/pages/index/component.rs:175-205 (`CandidateView`).
// Once every prerequisite is done on an Ongoing (join-anytime) space, the whole
// context restarts once so `role` reloads as Participant and the page swaps to
// the action dashboard.
export function CandidateView() {
  const ctx = useSpaceContext();
  const prereqs = ctx.actions.filter((a) => a.prerequisite);
  const allDone = prereqs.length === 0 || prereqs.every((a) => a.user_participated);

  const alreadyRestarted = React.useRef(false);
  const shouldRestart = allDone && ctx.space.status === SpaceStatus.Ongoing && !alreadyRestarted.current;
  React.useEffect(() => {
    if (shouldRestart && !alreadyRestarted.current) {
      alreadyRestarted.current = true;
      void ctx.restart();
    }
  }, [shouldRestart, ctx]);

  const te = useEnumI18n();
  const navigate = useNavigate();
  const announcement = ctx.actions.find((a) => a.action_type === "Announcement");

  return (
    <>
      {announcement && (
        <div
          className="prereq-item"
          data-testid="candidate-announcement-link"
          onClick={() => navigate(`/spaces/${ctx.spaceId}/actions/announcements/${announcement.action_id}`)}
        >
          <div className="prereq-item__info">
            <span className="prereq-item__title">{announcement.title}</span>
            <span className="prereq-item__type">{te("SpaceActionType", "Announcement")}</span>
          </div>
        </div>
      )}
      {allDone ? <WaitingCard prereqs={prereqs} /> : <PrerequisiteCard />}
    </>
  );
}
