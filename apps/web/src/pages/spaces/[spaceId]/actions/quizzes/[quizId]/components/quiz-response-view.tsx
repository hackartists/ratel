import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Answer, Question } from "@ratel/ts-bridges";
import { respondQuiz } from "@ratel/ts-bridges";
import { canExecuteSpaceAction, isParticipationOpen } from "@/components/space-actions/access";
import { FileCard } from "@/components/space-actions/file-card";
import { FullActionLayover } from "@/components/space-actions/full-action-layover";
import { hasAnswerForQuestion, QuestionViewer, shouldAutoNext } from "@/components/space-actions/question-viewer";
import { useSpace, useSpaceContext, useSpaceRole } from "@/components/space/space-context";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { useQuizReadI18n } from "./quiz-read.i18n";
import { timeAgo } from "@/lib/time";
import { useToast } from "@/lib/toast";
import { useQuizProvider } from "../hooks/use-quiz";

// quiz/views/main/quiz_read_page.rs (`QuizReadPage`) — shared by
// QuizParticipantPage (`canRespond=true`) and QuizViewerPage
// (`canRespond=false`).

function defaultAnswerForQuestion(question: Question): Answer {
  switch (question.answer_type) {
    case "single_choice":
      return { answer_type: "single_choice", answer: null, other: null };
    case "multiple_choice":
      return { answer_type: "multiple_choice", answer: [], other: null };
    case "short_answer":
      return { answer_type: "short_answer", answer: null };
    case "subjective":
      return { answer_type: "subjective", answer: null };
    case "checkbox":
      return { answer_type: "checkbox", answer: [] };
    case "dropdown":
      return { answer_type: "dropdown", answer: null };
    case "linear_scale":
      return { answer_type: "linear_scale", answer: null };
    case "privacy_consent":
      return { answer_type: "privacy_consent", agreed: false, phone: null, code: null };
  }
}

export function QuizResponseView({ spaceId, quizId, canRespond }: { spaceId: string; quizId: string; canRespond: boolean }) {
  const tr = useQuizReadI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { quiz, refreshQuiz } = useQuizProvider(spaceId, quizId, false);
  const space = useSpace();
  const role = useSpaceRole();
  const { restartRanking, restartMyScore } = useSpaceContext();
  const refreshScores = () => {
    void restartRanking();
    void restartMyScore();
  };

  const [step, setStep] = useState<"overview" | "quiz">("overview");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => quiz.my_response ?? quiz.questions.map(defaultAnswerForQuestion));

  const allAnswered = useMemo(() => {
    if (quiz.questions.length === 0) return false;
    return quiz.questions.every((q, idx) => hasAnswerForQuestion(q, answers[idx]));
  }, [quiz.questions, answers]);

  const isInProgress = quiz.space_action.status === "Ongoing";
  const canExecuteAction = canExecuteSpaceAction(
    role,
    quiz.space_action.prerequisite,
    space.status,
    quiz.space_action.status,
    true,
    isParticipationOpen(space),
  );
  const hasPassed = quiz.passed ?? false;
  const totalAllowed = quiz.retry_count + 1;
  const canSubmit = canRespond && canExecuteAction && isInProgress && !hasPassed && quiz.attempt_count < totalAllowed;
  const remainingSubmissions = Math.max(0, totalAllowed - quiz.attempt_count);
  const totalQuestions = quiz.questions.length;
  const currentIdx = Math.min(questionIndex, Math.max(totalQuestions - 1, 0));
  const currentQuestion = quiz.questions[currentIdx];
  const currentAnswer = answers[currentIdx];
  const hasCurrentAnswer = currentQuestion !== undefined ? hasAnswerForQuestion(currentQuestion, currentAnswer) : false;
  const isFirstQuestion = totalQuestions === 0 || currentIdx === 0;
  const isLastQuestion = totalQuestions === 0 || currentIdx + 1 >= totalQuestions;
  const quizNextDisabled = canSubmit && !hasCurrentAnswer;

  const onSubmit = () => {
    void respondQuiz(spaceId, quizId, { answers })
      .then(() => {
        refreshQuiz();
        refreshScores();
        toast.info(tr.submitSuccess);
        navigate(`/spaces/${spaceId}/actions`);
      })
      .catch((err) => {
        toast.error(err);
      });
  };

  const onCancel = () => navigate(`/spaces/${spaceId}/actions`);

  const remainingLabel = (
    <div className="text-sm text-foreground-muted">{`${tr.remainingSubmissions} ${remainingSubmissions}/${totalAllowed}`}</div>
  );

  if (step === "overview") {
    return (
      <FullActionLayover
        data-testid="quiz-read-overview"
        contentClassName="gap-6"
        bottomLeft={remainingLabel}
        bottomRight={
          <>
            <Button buttonStyle={ButtonStyle.Outline} shape={ButtonShape.Square} className="min-w-[120px]" onClick={onCancel}>
              {tr.btnCancel}
            </Button>
            <Button
              buttonStyle={ButtonStyle.Primary}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              disabled={quiz.questions.length === 0}
              data-testid="quiz-read-next"
              onClick={() => {
                setQuestionIndex(0);
                setStep("quiz");
              }}
            >
              {tr.btnNext}
            </Button>
          </>
        }
      >
        <div className="w-full">
          <div className="font-bold text-[28px]/[34px] text-text-primary">{quiz.title}</div>
          <div className="flex justify-end items-center py-4 border-y border-card-border">
            <div className="font-light shrink-0 text-[14px] text-text-primary">{timeAgo(quiz.created_at)}</div>
          </div>
          {quiz.description !== "" && (
            <div
              className="text-[15px]/[24px] tracking-[0.5px] text-foreground-muted"
              dangerouslySetInnerHTML={{ __html: quiz.description }}
            />
          )}
          {quiz.files.length > 0 && (
            <div className="grid grid-cols-4 gap-2.5 max-desktop:grid-cols-3 max-tablet:grid-cols-2 max-mobile:grid-cols-1">
              {quiz.files.map((file) => (
                <FileCard key={file.id} file={file} editable={false} />
              ))}
            </div>
          )}
        </div>
      </FullActionLayover>
    );
  }

  return (
    <FullActionLayover
      data-testid="quiz-read-quiz"
      bottomLeft={remainingLabel}
      bottomRight={
        <>
          {!isFirstQuestion && totalQuestions > 0 && (
            <Button
              buttonStyle={ButtonStyle.Outline}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              onClick={() => {
                if (currentIdx > 0) setQuestionIndex(currentIdx - 1);
              }}
            >
              {tr.btnBack}
            </Button>
          )}
          {!isLastQuestion && totalQuestions > 0 && (
            <Button
              buttonStyle={ButtonStyle.Outline}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              disabled={quizNextDisabled}
              onClick={() => {
                if (currentIdx + 1 < totalQuestions) setQuestionIndex(currentIdx + 1);
              }}
            >
              {tr.btnNext}
            </Button>
          )}
          {isLastQuestion && canRespond && totalQuestions > 0 && (
            <Button
              buttonStyle={ButtonStyle.Primary}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              disabled={!canSubmit || !allAnswered}
              onClick={onSubmit}
            >
              {tr.btnSubmit}
            </Button>
          )}
        </>
      }
    >
      <div className="w-full">
        {!isInProgress &&
          (quiz.space_action.status === "Finish" ? (
            <div className="p-3 text-sm rounded-lg bg-banner-bg text-banner-text">{tr.quizEnded}</div>
          ) : (
            <div className="p-3 text-sm rounded-lg bg-banner-bg text-banner-text">{tr.quizNotStarted}</div>
          ))}

        {isInProgress && !canExecuteAction && (
          <div className="p-3 text-sm rounded-lg bg-banner-bg text-banner-text">{tr.noPermission}</div>
        )}

        {isInProgress && canExecuteAction && hasPassed && (
          <div className="p-3 text-sm rounded-lg bg-banner-success-bg text-banner-success-text">{tr.alreadyPassed}</div>
        )}

        {isInProgress && canExecuteAction && !hasPassed && quiz.attempt_count >= totalAllowed && canRespond && (
          <div className="p-3 text-sm rounded-lg bg-banner-bg text-banner-text">{tr.noRemainingAttempts}</div>
        )}

        {totalQuestions === 0 ? (
          <div className="flex justify-center items-center py-10 text-foreground-muted">{tr.noQuestions}</div>
        ) : (
          <div key={`read-question-${currentIdx}`} className="w-full">
            <div className="flex justify-end items-center mb-5 font-normal text-[16px] text-text-primary">
              {`${tr.questionLabel}: ${currentIdx + 1}/${totalQuestions}`}
            </div>
            <div className="w-full [&_[data-question-title-wrap]]:mb-5 [&_[data-question-title-wrap]>div]:justify-center [&_[data-question-title]]:text-center [&_[data-question-title]]:text-[21px] [&_[data-question-desc]]:text-center">
              <QuestionViewer
                index={currentIdx}
                total={totalQuestions}
                question={currentQuestion!}
                answer={currentAnswer}
                disabled={!canRespond || !canExecuteAction || !isInProgress || !canSubmit}
                onChange={(next) => {
                  setAnswers((prev) => {
                    const nextArr = prev.slice();
                    nextArr[currentIdx] = next;
                    return nextArr;
                  });
                  if (canSubmit && currentIdx + 1 < totalQuestions && shouldAutoNext(currentQuestion!, next)) {
                    setQuestionIndex(currentIdx + 1);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </FullActionLayover>
  );
}
