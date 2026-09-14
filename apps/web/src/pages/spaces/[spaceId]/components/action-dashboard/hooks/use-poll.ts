// app/ratel/src/features/spaces/pages/index/action_dashboard/poll_card/component.rs:33 —
// `let poll = use_loader(move || async move { get_poll(space_id(), poll_id()).await })?;`
//
// Suspends until the poll loads; a failure reaches the error boundary like `use_loader(..)?`.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPoll, type PollResponse, type SpacePartition, type SpacePollEntityType } from "@ratel/ts-bridges";

/** Same key as the scaffolded `useGetPoll` hook. */
export const pollQueryKey = (spaceId: SpacePartition, pollId: SpacePollEntityType) =>
  ["getPoll", spaceId, pollId] as const;

export function usePoll(spaceId: SpacePartition, pollId: SpacePollEntityType): PollResponse {
  const { data } = useSuspenseQuery({
    queryKey: pollQueryKey(spaceId, pollId),
    queryFn: () => getPoll(spaceId, pollId),
  });
  return data;
}
