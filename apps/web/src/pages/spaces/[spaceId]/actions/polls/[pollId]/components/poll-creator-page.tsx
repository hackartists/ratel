import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionEditFooter, ActionEditSaveBusProvider } from "@/components/space-actions/action-edit-footer";
import { ActionEditTopbar } from "@/components/space-actions/action-edit-topbar";
import { useSpace } from "@/components/space/space-context";
import { usePollCreatorI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/poll/views/main/creator/poll-creator.i18n";
import { usePoll } from "../hooks/use-poll";
import { PollConfigCard } from "./poll-config-card";
import { PollContentCard } from "./poll-content-card";

// poll/views/main/creator/mod.rs (`PollCreatorPage`) — arena editor with a
// two-page pager (content, configuration).
export function PollCreatorPage() {
  const tr = usePollCreatorI18n();
  const navigate = useNavigate();
  const { poll } = usePoll();
  const space = useSpace();
  const [title] = useState(poll.title);
  const [currentPage, setCurrentPage] = useState(0);

  return (
    <ActionEditSaveBusProvider>
      <div className="arena">
        <ActionEditTopbar
          spaceName={space.title}
          actionTypeLabel={tr.typeBadgeLabel}
          actionTypeKey="poll"
          title={title}
          onTitleChange={() => undefined}
          editableTitle={false}
          onBack={() => navigate(-1)}
          onCancel={() => navigate(-1)}
        />
        <main className="pager">
          <div className="pager__track" style={{ transform: `translateX(-${currentPage * 100}%)` }}>
            <PollContentCard />
            <PollConfigCard />
          </div>
        </main>
        <ActionEditFooter currentPage={currentPage} onPageChange={setCurrentPage} totalPages={2} actionTypeKey="poll" />
      </div>
    </ActionEditSaveBusProvider>
  );
}
