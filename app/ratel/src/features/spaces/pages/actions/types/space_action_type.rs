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
    /// Space notice (one per space): shown to a user right before they join
    /// and pinned first in the action list. Content lives in the companion
    /// `SpaceAction.title`/`description`; it carries no reward and records
    /// no per-user completion.
    #[translate(ko = "공지", en = "Announcement")]
    #[cfg_attr(feature = "server", postgres(version = 1))]
    Announcement,
}

impl SpaceActionType {
    /// Reward behavior credited for this action type; `None` for types that
    /// carry no reward (`Announcement`).
    pub fn to_behavior(&self) -> Option<RewardUserBehavior> {
        match self {
            SpaceActionType::Poll => Some(RewardUserBehavior::RespondPoll),
            SpaceActionType::TopicDiscussion => Some(RewardUserBehavior::DiscussionComment),
            SpaceActionType::Quiz => Some(RewardUserBehavior::QuizAnswer),
            SpaceActionType::Follow => Some(RewardUserBehavior::Follow),
            SpaceActionType::Meet => Some(RewardUserBehavior::AttendMeet),
            SpaceActionType::Announcement => None,
        }
    }

}
