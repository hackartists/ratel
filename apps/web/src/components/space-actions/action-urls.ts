import type { SpaceActionSummary, SpaceActionType } from "@ratel/ts-bridges";

// `SpaceActionSummary::get_url` (types/space_action.rs) and the routes
// `SpaceActionType::create` navigates to.

export function actionUrl(spaceId: string, actionType: SpaceActionType, actionId: string): string {
  switch (actionType) {
    case "Poll":
      return `/spaces/${spaceId}/actions/polls/${actionId}`;
    // The arena owns the discussion viewer; outside it, go to the space home.
    case "TopicDiscussion":
      return `/spaces/${spaceId}`;
    case "Follow":
      return `/spaces/${spaceId}/actions/follows/${actionId}`;
    case "Quiz":
      return `/spaces/${spaceId}/actions/quizzes/${actionId}`;
    case "Meet":
      return `/spaces/${spaceId}/actions/meets/${actionId}`;
  }
}

export function summaryUrl(spaceId: string, action: SpaceActionSummary): string {
  return actionUrl(spaceId, action.action_type, action.action_id);
}

/** SubPartition id of a prefixed key (`SPACE_POLL#abc` → `abc`); ids without a prefix pass through. */
export function stripKeyPrefix(key: string): string {
  const at = key.indexOf("#");
  return at < 0 ? key : key.slice(at + 1);
}
