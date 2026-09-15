import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionEditFooter, ActionEditSaveBusProvider } from "@/components/space-actions/action-edit-footer";
import { ActionEditTopbar } from "@/components/space-actions/action-edit-topbar";
import { useSpace } from "@/components/space/space-context";
import { useQuizCreatorI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/quiz/views/main/creator/quiz-creator.i18n";
import { useQuizProvider, QuizProvider } from "../hooks/use-quiz";
import { QuizConfigCard } from "./quiz-config-card";
import { QuizContentCard } from "./quiz-content-card";
import { QuizQuestionsCard } from "./quiz-questions-card";

// quiz/views/main/creator/mod.rs (`QuizCreatorPage`) — arena editor with a
// three-page pager (content, questions, configuration).
export function QuizCreatorPage({ spaceId, quizId }: { spaceId: string; quizId: string }) {
  const controller = useQuizProvider(spaceId, quizId, true);
  const tr = useQuizCreatorI18n();
  const navigate = useNavigate();
  const space = useSpace();
  const [title] = useState(controller.quiz.title);
  const [currentPage, setCurrentPage] = useState(0);

  return (
    <QuizProvider value={controller}>
      <ActionEditSaveBusProvider>
        <div className="arena">
          <ActionEditTopbar
            spaceName={space.title}
            actionTypeLabel={tr.typeBadgeLabel}
            actionTypeKey="quiz"
            title={title}
            onTitleChange={() => undefined}
            editableTitle={false}
            onBack={() => navigate(-1)}
            onCancel={() => navigate(-1)}
          />
          <main className="pager">
            <div className="pager__track" style={{ transform: `translateX(-${currentPage * 100}%)` }}>
              <QuizContentCard />
              <QuizQuestionsCard />
              <QuizConfigCard />
            </div>
          </main>
          <ActionEditFooter currentPage={currentPage} onPageChange={setCurrentPage} totalPages={3} actionTypeKey="quiz" />
        </div>
      </ActionEditSaveBusProvider>
    </QuizProvider>
  );
}
