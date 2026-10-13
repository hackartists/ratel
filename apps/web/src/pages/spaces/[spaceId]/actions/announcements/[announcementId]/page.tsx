import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SpaceActionSummary, UpdateSpaceActionRequest } from "@ratel/ts-bridges";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { Editor } from "@/components/editor";
import { ActionStatusControl } from "@/components/space-actions/action-status-control";
import { useSpaceContext, useSpaceRole } from "@/components/space/space-context";
import { Button } from "@/components/ui/button";
import { SeoMeta } from "@/components/ui/seo-meta";
import { AnnouncementContent } from "@/pages/spaces/[spaceId]/components/announcement-notice";
import { useSpaceViewerI18n } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";
import { useToast } from "@/lib/toast";

/** `/spaces/:spaceId/actions/announcements/:announcementId`: creators edit the announcement, everyone else reads it. */
export function Component() {
  const { announcementId = "" } = useParams();
  const ctx = useSpaceContext();
  const isAdmin = useSpaceRole() === "Creator";
  const action = ctx.actions.find((a) => a.action_id === announcementId);

  if (!action) return null;

  return (
    <div className="flex flex-col gap-5 py-6 px-4 mx-auto w-full max-w-[760px]">
      {isAdmin ? <AnnouncementEditor action={action} /> : <AnnouncementViewer action={action} />}
    </div>
  );
}

/** Title input, the post body `Editor` and the publish control; every change is saved through `update_space_action`. */
function AnnouncementEditor({ action }: { action: SpaceActionSummary }) {
  const tr = useSpaceViewerI18n();
  const toast = useToast();
  const ctx = useSpaceContext();
  const update = useUpdateSpaceAction();
  const [title, setTitle] = useState(action.title);

  const save = (req: UpdateSpaceActionRequest) =>
    update
      .mutateAsync({ spaceId: ctx.spaceId, actionId: action.action_id, req })
      .then(() => void ctx.restartActions())
      .catch((e) => toast.error(e));

  return (
    <div className="flex flex-col gap-5" data-testid="announcement-editor-view">
      <SeoMeta title={tr.announcementName} />
      <ActionStatusControl
        spaceId={ctx.spaceId}
        actionId={action.action_id}
        initialStatus={action.status}
        onChanged={() => void ctx.restartActions()}
      />
      <input
        className="title-input"
        data-testid="announcement-title-input"
        placeholder={tr.announcementTitlePlaceholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void save({ title })}
      />
      <Editor
        className="w-full"
        content={action.description}
        editable
        placeholder={tr.announcementBodyPlaceholder}
        onContentChange={(description) => void save({ description })}
      />
    </div>
  );
}

/** Read-only announcement for participants; the confirm button returns to the space home. */
function AnnouncementViewer({ action }: { action: SpaceActionSummary }) {
  const tr = useSpaceViewerI18n();
  const navigate = useNavigate();
  const spaceId = useSpaceContext().spaceId;

  return (
    <div className="flex flex-col gap-4" data-testid="announcement-viewer-view">
      <SeoMeta title={action.title} />
      <AnnouncementContent action={action} />
      <div className="flex justify-start pt-2">
        <Button data-testid="btn-announcement-confirm" onClick={() => navigate(`/spaces/${spaceId}`)}>
          {tr.announcementConfirm}
        </Button>
      </div>
    </div>
  );
}
