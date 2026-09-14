import { Button } from "@/components/ui/button";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useMeetActionI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/meet/components/meet_page/meet-action.i18n";
import { useMeet } from "../hooks/use-meet";

// meet/components/meet_page/viewer_view.rs — scheduled / live / ended states.
// Joining and archives are "Coming Soon" (disabled buttons) in Rust too.
export function MeetViewerView() {
  const tr = useMeetActionI18n();
  const { meet } = useMeet();
  const title = meet.space_action.title;
  const description = meet.space_action.description;
  const status = meet.space_action.status ?? "Designing";
  const now = Date.now();
  const startTime = meet.start_time;
  const duration = meet.duration_min;
  const isLive = status === "Ongoing" && startTime <= now && now < startTime + duration * 60_000;
  const isScheduled = status === "Ongoing" && now < startTime;
  const isEnded = status === "Finish";

  return (
    <>
      <SeoMeta title={title} />
      <div className="meet-viewer" data-testid="meet-viewer-view">
        <h1 className="meet-viewer__title">{title}</h1>
        <p className="meet-viewer__desc">{description}</p>

        {isScheduled ? (
          <div className="meet-viewer__scheduled">
            <span className="meet-viewer__scheduled-label">{tr.scheduledStartsAt}</span>
            <span className="meet-viewer__scheduled-ts">{startTime}</span>
          </div>
        ) : isLive ? (
          <div className="meet-viewer__live">
            <span className="meet-viewer__live-label">{tr.liveLabel}</span>
            <span className="meet-viewer__coming-soon">{tr.comingSoonBadge}</span>
            <Button disabled data-testid="meet-live-join">
              {tr.liveCta}
            </Button>
          </div>
        ) : isEnded ? (
          <div className="meet-viewer__ended">
            <span className="meet-viewer__ended-label">{tr.endedLabel}</span>
            <span className="meet-viewer__coming-soon">{tr.comingSoonBadge}</span>
            <Button disabled data-testid="meet-ended-archive">
              {tr.endedCta}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
