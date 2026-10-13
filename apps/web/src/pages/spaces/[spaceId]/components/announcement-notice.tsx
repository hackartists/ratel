import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { Editor } from "@/components/editor";
import { useSpaceViewerI18n } from "./space-viewer.i18n";

/** Announcement title and body; the body HTML is rendered by the read-only `Editor` so it keeps the authored formatting. */
export function AnnouncementContent({ action }: { action: SpaceActionSummary }) {
  return (
    <>
      <h1 className="font-bold text-[1.75rem]/[1.2] text-text-primary" data-testid="announcement-title">
        {action.title}
      </h1>
      <div data-testid="announcement-body">
        <Editor key={action.description} className="w-full" content={action.description} editable={false} />
      </div>
    </>
  );
}

/** The step shown by `ParticipateCard` before the participate request: the announcement plus a continue button. */
export function AnnouncementNotice({ action, onContinue }: { action: SpaceActionSummary; onContinue: () => void }) {
  const tr = useSpaceViewerI18n();
  return (
    <div className="participate-card" data-testid="card-announcement">
      <span className="participate-card__heading">{tr.announcementName}</span>
      <div className="flex overflow-y-auto flex-col gap-3 w-full text-left max-h-[50vh]">
        <AnnouncementContent action={action} />
      </div>
      <button className="cta-participate" data-testid="btn-announcement-continue" onClick={onContinue}>
        {tr.announcementContinue}
      </button>
    </div>
  );
}
