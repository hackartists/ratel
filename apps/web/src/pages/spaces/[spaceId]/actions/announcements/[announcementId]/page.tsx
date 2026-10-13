import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SpaceActionStatus, SpaceActionSummary, UpdateSpaceActionRequest } from "@ratel/ts-bridges";
import { useReadSpaceAnnouncement, useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { Editor } from "@/components/editor";
import { ActionEditTopbar } from "@/components/space-actions/action-edit-topbar";
import { useSpace, useSpaceContext, useSpaceRole } from "@/components/space/space-context";
import { SeoMeta } from "@/components/ui/seo-meta";
import { AnnouncementNotice } from "@/pages/spaces/[spaceId]/components/announcement-notice";
import { ArenaBackdrop } from "@/pages/spaces/[spaceId]/components/arena-viewer";
import { useSpaceViewerI18n } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";
import { useToast } from "@/lib/toast";

/** `/spaces/:spaceId/actions/announcements/:announcementId`: creators edit the announcement, everyone else reads it. */
export function Component() {
  const { announcementId = "" } = useParams();
  const ctx = useSpaceContext();
  const isAdmin = useSpaceRole() === "Creator";
  const action = ctx.actions.find((a) => a.action_id === announcementId);

  if (!action) return null;

  if (isAdmin) return <AnnouncementEditor action={action} />;

  return <AnnouncementViewer action={action} />;
}

/**
 * Topbar with a back button and a Save button, above the title input and post body `Editor`.
 * Save persists the title/body and publishes the announcement (moves it to `Ongoing`); there is no close step.
 */
function AnnouncementEditor({ action }: { action: SpaceActionSummary }) {
  const tr = useSpaceViewerI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const ctx = useSpaceContext();
  const space = useSpace();
  const update = useUpdateSpaceAction();
  const [title, setTitle] = useState(action.title);
  const [description, setDescription] = useState(action.description);
  const [saving, setSaving] = useState(false);

  const send = (req: UpdateSpaceActionRequest) =>
    update.mutateAsync({ spaceId: ctx.spaceId, actionId: action.action_id, req });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await send({ title });
      await send({ description });
      let status: SpaceActionStatus | null = action.status;
      if (status === null) {
        await send({ status: "Designing" });
        status = "Designing";
      }
      if (status === "Designing") await send({ status: "Ongoing" });
      await ctx.restartActions();
      toast.info(tr.announcementSaved);
    } catch (e) {
      toast.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="arena" data-testid="announcement-editor-view">
      <SeoMeta title={tr.announcementName} />
      <ActionEditTopbar
        spaceName={space.title}
        actionTypeLabel={tr.announcementName}
        actionTypeKey="announcement"
        title={title}
        onTitleChange={setTitle}
        editableTitle={false}
        rightActions={
          <button
            className="btn btn--primary"
            type="button"
            data-testid="announcement-save-btn"
            disabled={saving}
            onClick={() => void save()}
          >
            {tr.announcementSave}
          </button>
        }
        onBack={() => navigate(-1)}
        onCancel={() => navigate(-1)}
      />
      <div className="flex flex-col gap-5 py-6 px-4 mx-auto w-full max-w-[760px]">
        <input
          className="title-input"
          data-testid="announcement-title-input"
          placeholder={tr.announcementTitlePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Editor
          className="w-full"
          content={action.description}
          editable
          placeholder={tr.announcementBodyPlaceholder}
          onContentChange={setDescription}
        />
      </div>
    </div>
  );
}

/**
 * Read-only announcement for everyone but the creator, drawn as the same `AnnouncementNotice`
 * card the join flow shows, on the same arena stage. Continue records the read for joined
 * members who have not read it yet (so the dashboard archives it), then returns to the space home.
 */
function AnnouncementViewer({ action }: { action: SpaceActionSummary }) {
  const tr = useSpaceViewerI18n();
  const navigate = useNavigate();
  const ctx = useSpaceContext();
  const role = useSpaceRole();
  const toast = useToast();
  const readAnnouncement = useReadSpaceAnnouncement();
  const [continuing, setContinuing] = useState(false);

  const proceed = async () => {
    if (continuing) return;
    setContinuing(true);
    const joined = role === "Participant" || role === "Candidate";
    if (joined && !action.user_participated) {
      try {
        await readAnnouncement.mutateAsync({ spaceId: ctx.spaceId, actionId: action.action_id });
        await ctx.restartActions();
      } catch (e) {
        toast.error(e);
        setContinuing(false);
        return;
      }
    }
    navigate(`/spaces/${ctx.spaceId}`);
  };

  return (
    <div className="arena" data-testid="announcement-viewer-view">
      <SeoMeta title={action.title === "" ? tr.announcementName : action.title} />
      <div className="arena-viewer">
        <ArenaBackdrop />
        <div className="portal" data-announcement="true">
          <AnnouncementNotice action={action} busy={continuing} onContinue={() => void proceed()} />
        </div>
      </div>
    </div>
  );
}
