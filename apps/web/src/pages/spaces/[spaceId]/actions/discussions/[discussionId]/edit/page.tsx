import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ActionEditFooter, ActionEditSaveBusProvider } from "@/components/space-actions/action-edit-footer";
import { ActionEditTopbar } from "@/components/space-actions/action-edit-topbar";
import { useActionSpace } from "@/components/space-actions/space-data";
import { useDiscussionEditorI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/discussion/views/editor/discussion-editor.i18n";
import { DiscussionConfigCard } from "./components/discussion-config-card";
import { DiscussionContentCard } from "./components/discussion-content-card";
import { DiscussionProvider, useDiscussionProvider } from "./hooks/use-discussion";

// discussion/views/editor/mod.rs (`DiscussionActionEditorPage`) — arena
// editor with a two-page pager (content, configuration) and a topbar
// "Import from overview" action that overwrites the content card's
// title/body from the space overview.
export function Component() {
  const { spaceId = "", discussionId = "" } = useParams();
  const navigate = useNavigate();
  const controller = useDiscussionProvider(spaceId, discussionId);
  const tr = useDiscussionEditorI18n();
  const space = useActionSpace(spaceId); // space-context: use_space()
  const [title] = useState(controller.discussion.post.title);
  const [currentPage, setCurrentPage] = useState(0);

  return (
    <DiscussionProvider value={controller}>
      <ActionEditSaveBusProvider>
        <div className="arena">
          <ActionEditTopbar
            spaceName={space.title}
            actionTypeLabel={tr.typeBadgeLabel}
            actionTypeKey="discussion"
            title={title}
            onTitleChange={() => undefined}
            editableTitle={false}
            rightActions={
              <button
                className="btn btn--secondary"
                type="button"
                data-testid="discussion-import-overview"
                onClick={() => controller.requestImport()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {tr.importFromOverview}
              </button>
            }
            onBack={() => navigate(-1)}
            onCancel={() => navigate(-1)}
          />
          <main className="pager">
            <div className="pager__track" style={{ transform: `translateX(-${currentPage * 100}%)` }}>
              <DiscussionContentCard />
              <DiscussionConfigCard />
            </div>
          </main>
          <ActionEditFooter currentPage={currentPage} onPageChange={setCurrentPage} totalPages={2} actionTypeKey="discussion" />
        </div>
      </ActionEditSaveBusProvider>
    </DiscussionProvider>
  );
}
