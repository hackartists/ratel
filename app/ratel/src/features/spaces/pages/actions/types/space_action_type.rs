use crate::{common::RewardUserBehavior, features::spaces::pages::actions::*};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[derive(Debug, Clone, Default, Translate, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum SpaceActionType {
    #[default]
    // #[translate(ko = "숙의 및 퀴즈", en = "Quiz")]
    // StudyAndQuiz,
    #[translate(ko = "투표", en = "Poll")]
    Poll,
    #[translate(ko = "토론", en = "Discussion")]
    TopicDiscussion,
    #[translate(ko = "팔로우", en = "Follow")]
    Follow,
    #[translate(ko = "퀴즈", en = "Quiz")]
    Quiz,
    #[translate(ko = "미팅", en = "Meet")]
    Meet,
}

impl SpaceActionType {
    pub fn to_behavior(&self) -> RewardUserBehavior {
        match self {
            SpaceActionType::Poll => RewardUserBehavior::RespondPoll,
            SpaceActionType::TopicDiscussion => RewardUserBehavior::DiscussionComment,
            SpaceActionType::Quiz => RewardUserBehavior::QuizAnswer,
            SpaceActionType::Follow => RewardUserBehavior::Follow,
            SpaceActionType::Meet => RewardUserBehavior::AttendMeet,
        }
    }

}
