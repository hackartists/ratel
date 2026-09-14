import { useParams } from "react-router-dom";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getQuiz } from "@ratel/ts-bridges";
import { isActionLocked } from "@/components/space-actions/access";
import {
  ActionEditModeContext,
  SettingsSwitchButton,
  useActionEditModeState,
} from "@/components/space-actions/settings-switch-button";
import { useActionSpace, useActionSpaceRole } from "@/components/space-actions/space-data";
import { QuizCreatorPage } from "./components/quiz-creator-page";
import { QuizResponseView } from "./components/quiz-response-view";

// app/ratel/src/features/spaces/pages/actions/actions/quiz/views/main/mod.rs
// (`QuizActionPage`): creators configure the action until it starts (or with
// edit mode on) or as an admin; everyone else (participant, candidate, and
// the creator once locked) gets the response/results view, minus the
// respond controls for viewers.
export function Component() {
  const { spaceId = "", quizId = "" } = useParams();
  const { currentRole, isAdmin } = useActionSpaceRole(spaceId); // space-context: use_space_role() / space_ctx.role()
  const space = useActionSpace(spaceId); // space-context: use_space()
  const quiz = useSuspenseQuery({ queryKey: ["getQuiz", spaceId, quizId], queryFn: () => getQuiz(spaceId, quizId) }).data;
  const locked = isActionLocked(space.status, quiz.space_action.status);

  const editMode = useActionEditModeState(isAdmin);
  const showCreatorView = isAdmin || !locked || editMode.editMode;

  let content;
  if ((currentRole === "Creator" && showCreatorView) || isAdmin) {
    content = <QuizCreatorPage spaceId={spaceId} quizId={quizId} />;
  } else if (currentRole === "Viewer") {
    content = <QuizResponseView spaceId={spaceId} quizId={quizId} canRespond={false} />;
  } else {
    // Creator (locked, edit mode off) | Participant | Candidate.
    content = <QuizResponseView spaceId={spaceId} quizId={quizId} canRespond />;
  }

  return (
    <ActionEditModeContext.Provider value={editMode}>
      <div className={showCreatorView ? "flex flex-col flex-1 w-full min-h-0" : "flex flex-col flex-1 mx-auto w-full min-h-0 max-w-desktop"}>
        {!showCreatorView && <SettingsSwitchButton spaceId={spaceId} />}
        {content}
      </div>
    </ActionEditModeContext.Provider>
  );
}
