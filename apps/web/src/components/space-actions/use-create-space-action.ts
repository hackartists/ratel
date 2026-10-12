import { createDiscussion, createFollow, createMeet, createPoll, createQuiz, createSpaceAnnouncement } from "@ratel/ts-bridges";
import type { SpaceActionType } from "@ratel/ts-bridges";
import { stripKeyPrefix } from "./action-urls";

// `SpaceActionType::create` (types/space_action_type.rs): creates an empty
// action of the given type and returns the editor URL to open.
export async function createSpaceAction(spaceId: string, actionType: SpaceActionType): Promise<string> {
  switch (actionType) {
    case "Poll": {
      const response = await createPoll(spaceId);
      return `/spaces/${spaceId}/actions/polls/${stripKeyPrefix(response.sk)}`;
    }
    case "TopicDiscussion": {
      const response = await createDiscussion(spaceId);
      return `/spaces/${spaceId}/actions/discussions/${response.post_id}/edit`;
    }
    case "Follow": {
      const response = await createFollow(spaceId);
      return `/spaces/${spaceId}/actions/follows/${response.follow_id}`;
    }
    case "Quiz": {
      const response = await createQuiz(spaceId);
      return `/spaces/${spaceId}/actions/quizzes/${response.quiz_id}`;
    }
    case "Meet": {
      const response = await createMeet(spaceId);
      return `/spaces/${spaceId}/actions/meets/${response.sk}`;
    }
    case "Announcement": {
      const response = await createSpaceAnnouncement(spaceId);
      return `/spaces/${spaceId}/actions/announcements/${response.action_id}`;
    }
  }
}
