import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { Editor } from "@/components/editor";
import { useSpaceViewerI18n } from "./space-viewer.i18n";

/** Announcement body HTML rendered by the read-only `Editor`, so headings, lists and inline formatting keep the authored look. */
export function AnnouncementBody({ action }: { action: SpaceActionSummary }) {
  return (
    <div className="announcement-body" data-testid="announcement-body">
      <Editor key={action.description} className="w-full" content={action.description} editable={false} />
    </div>
  );
}

/** Announcement title and body. */
export function AnnouncementContent({ action }: { action: SpaceActionSummary }) {
  return (
    <>
      <h1 className="font-bold text-[1.75rem]/[1.2] text-text-primary" data-testid="announcement-title">
        {action.title}
      </h1>
      <AnnouncementBody action={action} />
    </>
  );
}

/**
 * The step shown by `ParticipateCard` before the participate request: a near
 * full-screen card headed by the announcement title, its formatted body and a
 * continue button. `ArenaViewer` hides the portal header while it is shown.
 */
export function AnnouncementNotice({ action, onContinue }: { action: SpaceActionSummary; onContinue: () => void }) {
  const tr = useSpaceViewerI18n();
  return (
    <div className="participate-card announcement-notice" data-testid="card-announcement">
      <h1 className="announcement-notice__title" data-testid="announcement-title">
        {action.title === "" ? tr.announcementName : action.title}
      </h1>
      <div className="announcement-notice__body">
        <AnnouncementBody action={action} />
      </div>
      <button className="cta-participate" data-testid="btn-announcement-continue" onClick={onContinue}>
        {tr.announcementContinue}
      </button>
    </div>
  );
}
