import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { getQuiz, getQuizAnswer } from "@ratel/ts-bridges";
import type { Question, QuizAnswerResponse, QuizCorrectAnswer, QuizResponse } from "@ratel/ts-bridges";

// quiz/context.rs (`Context::init`) — the quiz + correct-answer loaders and
// the editable local state (questions/answers/retry_count/pass_score) shared
// by the creator's three cards. `answer` is only fetched for the creator
// role (participants/viewers never see correct answers).

function correctAnswerForQuestion(q: Question): QuizCorrectAnswer {
  return q.answer_type === "multiple_choice" ? { answer_type: "multiple", answers: [] } : { answer_type: "single", answer: null };
}

/** `align_answers` — pads/retypes the correct-answer list to match `questions`. */
function alignAnswers(questions: Question[], answers: QuizCorrectAnswer[]): QuizCorrectAnswer[] {
  return questions.map((q, idx) => {
    const existing = answers[idx];
    if (q.answer_type === "multiple_choice") {
      return existing?.answer_type === "multiple" ? existing : correctAnswerForQuestion(q);
    }
    return existing?.answer_type === "single" ? existing : correctAnswerForQuestion(q);
  });
}

export interface UseQuiz {
  spaceId: string;
  quizId: string;
  quiz: QuizResponse;
  refreshQuiz: () => void;
  questions: Question[];
  setQuestions: Dispatch<SetStateAction<Question[]>>;
  answers: QuizCorrectAnswer[];
  setAnswers: Dispatch<SetStateAction<QuizCorrectAnswer[]>>;
  retryCount: number;
  setRetryCount: Dispatch<SetStateAction<number>>;
  passScore: number;
  setPassScore: Dispatch<SetStateAction<number>>;
}

const QuizContext = createContext<UseQuiz | null>(null);
export const QuizProvider = QuizContext.Provider;

export function useQuiz(): UseQuiz {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuiz must be used under QuizProvider");
  return ctx;
}

export function useQuizProvider(spaceId: string, quizId: string, isCreatorRole: boolean): UseQuiz {
  const queryClient = useQueryClient();
  const quizKey = ["getQuiz", spaceId, quizId];
  const quiz = useSuspenseQuery({ queryKey: quizKey, queryFn: () => getQuiz(spaceId, quizId) }).data;

  const answerKey = ["getQuizAnswer", spaceId, quizId, isCreatorRole];
  const answerResp = useSuspenseQuery({
    queryKey: answerKey,
    queryFn: (): Promise<QuizAnswerResponse> =>
      isCreatorRole
        ? getQuizAnswer(spaceId, quizId)
        : Promise.resolve({ quiz_id: quizId, space_id: spaceId, created_at: 0, updated_at: 0, answers: [] }),
  }).data;

  const alignedAnswers = useMemo(() => alignAnswers(quiz.questions, answerResp.answers), [quiz.questions, answerResp.answers]);

  const [questions, setQuestions] = useState(quiz.questions);
  const [answers, setAnswers] = useState(alignedAnswers);
  const [retryCount, setRetryCount] = useState(quiz.retry_count);
  const [passScore, setPassScore] = useState(quiz.pass_score);

  return {
    spaceId,
    quizId,
    quiz,
    refreshQuiz: () => {
      void queryClient.invalidateQueries({ queryKey: quizKey });
      void queryClient.invalidateQueries({ queryKey: answerKey });
    },
    questions,
    setQuestions,
    answers,
    setAnswers,
    retryCount,
    setRetryCount,
    passScore,
    setPassScore,
  };
}
