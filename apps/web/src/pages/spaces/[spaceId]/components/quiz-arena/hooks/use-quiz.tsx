// app/ratel/src/features/spaces/pages/index/action_pages/quiz/component.rs:49 —
// `let mut quiz_loader = use_loader(move || get_quiz(space_id(), quiz_id()))?;`
//
// Suspends until the quiz loads (render inside `<Suspense fallback={null}>`);
// a failure reaches the route error boundary like `use_loader(..)?`.
// `restart()` is Rust `quiz_loader.restart()`: re-fetch while keeping the
// previous data on screen.
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getQuiz, type QuizResponse, type SpacePartition, type SpaceQuizEntityType } from "@ratel/ts-bridges";

/** Same key as the scaffolded `useGetQuiz` hook. */
export const quizQueryKey = (spaceId: SpacePartition, quizId: SpaceQuizEntityType) =>
  ["getQuiz", spaceId, quizId] as const;

export function useQuiz(
  spaceId: SpacePartition,
  quizId: SpaceQuizEntityType,
): { quiz: QuizResponse; restart: () => Promise<void> } {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: quizQueryKey(spaceId, quizId),
    queryFn: () => getQuiz(spaceId, quizId),
  });
  const restart = () =>
    queryClient.refetchQueries({ queryKey: quizQueryKey(spaceId, quizId), exact: true }).then(() => undefined);
  return { quiz: data, restart };
}
