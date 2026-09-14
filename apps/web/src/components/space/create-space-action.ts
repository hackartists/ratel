// app/ratel/src/features/spaces/pages/actions/types/space_action_type.rs:36-77 —
// `SpaceActionType::create(space_id) -> Result<Route>`: creates an empty action
// of the given type and returns the editor route for it.
//
// Shared by the action dashboard's type picker and the actions page:
//
//   const createSpaceAction = useCreateSpaceAction();
//   try {
//     const path = await createSpaceAction("Poll", spaceId);
//     navigate(path);
//   } catch (err) {
//     toast.error(err);
//   }
import { useCreateDiscussion, useCreateFollow, useCreateMeet, useCreatePoll, useCreateQuiz } from "@ratel/ts-bridges/hooks";
import type { SpaceActionType, SpacePartition } from "@ratel/ts-bridges";

/** `EntityType` / `Partition` wire prefixes of the SubPartition ids used by space actions. */
export const EntityPrefix = {
  SpacePoll: "SPACE_POLL#",
  SpaceQuiz: "SPACE_QUIZ#",
  SpacePost: "SPACE_POST#",
  SpaceActionFollow: "SPACE_ACTION_FOLLOW#",
  SpaceMeet: "SPACE_MEET#",
} as const;
export type EntityPrefix = (typeof EntityPrefix)[keyof typeof EntityPrefix];

/**
 * `impl From<String> for XxxEntityType` (packages/by-macros/src/sub_partition):
 * `%23` becomes `#`, and the prefix is stripped when present.
 */
export function subPartitionId(value: string, prefix: EntityPrefix): string {
  const s = value.split("%23").join("#");
  return s.startsWith(prefix) ? s.split(prefix).join("") : s;
}

/**
 * `impl From<EntityType> for XxxEntityType`: the id of the matching variant,
 * `""` for any other variant.
 */
export function subPartitionFromEntity(entity: string, prefix: EntityPrefix): string {
  return entity.startsWith(prefix) ? entity.slice(prefix.length) : "";
}

/** Rust `SpaceActionType::create`. Resolves to the route path; rejects with the API error. */
export function useCreateSpaceAction(): (type: SpaceActionType, spaceId: SpacePartition) => Promise<string> {
  const createPoll = useCreatePoll();
  const createDiscussion = useCreateDiscussion();
  const createFollow = useCreateFollow();
  const createQuiz = useCreateQuiz();
  const createMeet = useCreateMeet();

  return async (type, spaceId) => {
    switch (type) {
      case "Poll": {
        const response = await createPoll.mutateAsync(spaceId);
        // `SpacePollEntityType::from(response.sk)` — `sk` is the `EntityType` (`SPACE_POLL#<id>`).
        const pollId = subPartitionFromEntity(response.sk, EntityPrefix.SpacePoll);
        return `/spaces/${spaceId}/actions/polls/${pollId}`;
      }
      case "TopicDiscussion": {
        const response = await createDiscussion.mutateAsync(spaceId);
        // `SpacePostEntityType(response.post_id)` — tuple constructor, no prefix handling.
        return `/spaces/${spaceId}/actions/discussions/${response.post_id}/edit`;
      }
      case "Follow": {
        const response = await createFollow.mutateAsync(spaceId);
        return `/spaces/${spaceId}/actions/follows/${response.follow_id}`;
      }
      case "Quiz": {
        const response = await createQuiz.mutateAsync(spaceId);
        return `/spaces/${spaceId}/actions/quizzes/${response.quiz_id}`;
      }
      case "Meet": {
        const response = await createMeet.mutateAsync(spaceId);
        return `/spaces/${spaceId}/actions/meets/${response.sk}`;
      }
    }
  };
}
