import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFollow } from "@ratel/ts-bridges";
import { ActionEditFooter, ActionEditSaveBusProvider } from "@/components/space-actions/action-edit-footer";
import { ActionEditTopbar } from "@/components/space-actions/action-edit-topbar";
import { useSpace } from "@/components/space/space-context";
import { useFollowCreatorI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/follow/views/main/creator/follow-creator.i18n";
import { FollowConfigCard } from "./follow-config-card";
import { FollowTargetsCard } from "./follow-targets-card";

// follow/views/main/creator/mod.rs (`FollowCreatorPage`) — arena editor with a
// two-page pager (targets, configuration).
export function FollowCreatorPage({ spaceId, followId }: { spaceId: string; followId: string }) {
  const tr = useFollowCreatorI18n();
  const navigate = useNavigate();
  const action = useSuspenseQuery({
    queryKey: ["getFollow", spaceId, followId],
    queryFn: () => getFollow(spaceId, followId),
  }).data;
  const space = useSpace();
  const [title] = useState(action.title);
  // The config card snapshots the action once, like the Rust `ReadSignal` seeded at mount.
  const [actionSetting] = useState(action);
  const [currentPage, setCurrentPage] = useState(0);

  return (
    <ActionEditSaveBusProvider>
      <div className="arena">
        <ActionEditTopbar
          spaceName={space.title}
          actionTypeLabel={tr.typeBadgeLabel}
          actionTypeKey="follow"
          title={title}
          onTitleChange={() => undefined}
          editableTitle={false}
          onBack={() => navigate(-1)}
          onCancel={() => navigate(-1)}
        />
        <main className="pager">
          <div className="pager__track" style={{ transform: `translateX(-${currentPage * 100}%)` }}>
            <FollowTargetsCard spaceId={spaceId} followId={followId} initialTitle={action.title} />
            <FollowConfigCard spaceId={spaceId} followId={followId} action={actionSetting} />
          </div>
        </main>
        <ActionEditFooter currentPage={currentPage} onPageChange={setCurrentPage} totalPages={2} actionTypeKey="follow" />
      </div>
    </ActionEditSaveBusProvider>
  );
}
